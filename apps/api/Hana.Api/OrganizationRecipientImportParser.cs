using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;

namespace Hana.Api;

internal sealed record OrganizationRecipientImportCell(
    string Value,
    bool IsText,
    bool HasFormula);

internal sealed record OrganizationRecipientImportRow(
    int RowNumber,
    OrganizationRecipientImportCell DisplayName,
    OrganizationRecipientImportCell ExternalReference,
    OrganizationRecipientImportCell Phone);

internal sealed record OrganizationRecipientImportError(
    int Row,
    string Field,
    string Code,
    string Message);

internal sealed record OrganizationRecipientImportParseResult(
    IReadOnlyList<OrganizationRecipientImportRow> Rows,
    IReadOnlyList<OrganizationRecipientImportError> Errors);

internal static class OrganizationRecipientImportParser
{
    internal const long MaxFileBytes = 2 * 1024 * 1024;
    internal const int MaxRows = 500;
    private const long MaxExpandedXlsxBytes = 8 * 1024 * 1024;
    private const int MaxZipEntries = 128;

    private static readonly UTF8Encoding StrictUtf8 =
        new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    internal static async Task<OrganizationRecipientImportParseResult> ParseAsync(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file.Length is <= 0 or > MaxFileBytes)
            return FileError(
                "FILE_SIZE",
                "حجم فایل باید بیشتر از صفر و حداکثر ۲ مگابایت باشد.");

        await using var source = file.OpenReadStream();
        using var buffer = new MemoryStream((int)file.Length);
        await source.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        return extension switch
        {
            ".csv" => ParseCsv(bytes),
            ".xlsx" => ParseXlsx(bytes),
            _ => FileError(
                "FILE_TYPE",
                "فقط فایل CSV یا XLSX پذیرفته می‌شود.")
        };
    }

    private static OrganizationRecipientImportParseResult ParseCsv(
        byte[] bytes)
    {
        string text;
        try
        {
            text = StrictUtf8.GetString(bytes);
        }
        catch (DecoderFallbackException)
        {
            return FileError(
                "CSV_ENCODING",
                "فایل CSV باید UTF-8 معتبر باشد.");
        }

        if (text.Length > 0 && text[0] == '\uFEFF')
            text = text[1..];

        var parsed = ParseCsvRecords(text);
        if (parsed.Error is not null)
            return FileError("CSV_FORMAT", parsed.Error);

        return MapTabularRows(
            parsed.Records!
                .Select((record, index) => new TabularRow(
                    index + 1,
                    record.Select(value =>
                        new OrganizationRecipientImportCell(
                            value,
                            IsText: true,
                            HasFormula: false))
                        .ToArray()))
                .ToArray());
    }

    private static (
        IReadOnlyList<IReadOnlyList<string>>? Records,
        string? Error)
        ParseCsvRecords(string text)
    {
        var records = new List<IReadOnlyList<string>>();
        var row = new List<string>();
        var field = new StringBuilder();
        var quoted = false;
        var afterQuote = false;

        void FinishField()
        {
            row.Add(field.ToString());
            field.Clear();
            afterQuote = false;
        }

        void FinishRow()
        {
            FinishField();
            records.Add(row.ToArray());
            row.Clear();
        }

        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];

            if (quoted)
            {
                if (ch == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        field.Append('"');
                        i++;
                    }
                    else
                    {
                        quoted = false;
                        afterQuote = true;
                    }
                }
                else
                {
                    field.Append(ch);
                }

                continue;
            }

            if (afterQuote)
            {
                if (ch == ',')
                {
                    FinishField();
                    continue;
                }

                if (ch == '\r' || ch == '\n')
                {
                    if (ch == '\r' &&
                        i + 1 < text.Length &&
                        text[i + 1] == '\n')
                        i++;
                    FinishRow();
                    continue;
                }

                if (char.IsWhiteSpace(ch))
                    continue;

                return (null,
                    "بعد از بسته‌شدن مقدار نقل‌قول‌شده فقط جداکننده یا پایان ردیف مجاز است.");
            }

            if (ch == '"' && field.Length == 0)
            {
                quoted = true;
                continue;
            }

            if (ch == ',')
            {
                FinishField();
                continue;
            }

            if (ch == '\r' || ch == '\n')
            {
                if (ch == '\r' &&
                    i + 1 < text.Length &&
                    text[i + 1] == '\n')
                    i++;
                FinishRow();
                continue;
            }

            field.Append(ch);
        }

        if (quoted)
            return (null, "نقل‌قول CSV بسته نشده است.");

        if (row.Count > 0 || field.Length > 0 || afterQuote)
            FinishRow();

        return (records, null);
    }

    private static OrganizationRecipientImportParseResult ParseXlsx(
        byte[] bytes)
    {
        try
        {
            using var stream = new MemoryStream(bytes, writable: false);
            using var archive = new ZipArchive(
                stream,
                ZipArchiveMode.Read,
                leaveOpen: false);

            if (archive.Entries.Count is 0 or > MaxZipEntries)
                return FileError(
                    "XLSX_STRUCTURE",
                    "ساختار فایل XLSX معتبر نیست.");

            long expanded = 0;
            foreach (var entry in archive.Entries)
            {
                expanded += entry.Length;
                if (entry.Length > MaxExpandedXlsxBytes ||
                    expanded > MaxExpandedXlsxBytes)
                    return FileError(
                        "XLSX_EXPANDED_SIZE",
                        "حجم بازشده فایل XLSX بیش از حد مجاز است.");
            }

            var workbookEntry = archive.GetEntry("xl/workbook.xml");
            var relsEntry =
                archive.GetEntry("xl/_rels/workbook.xml.rels");
            if (workbookEntry is null || relsEntry is null)
                return FileError(
                    "XLSX_STRUCTURE",
                    "ساختار workbook فایل XLSX معتبر نیست.");

            var workbook = LoadXml(workbookEntry);
            var rels = LoadXml(relsEntry);
            XNamespace main =
                "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            XNamespace relDoc =
                "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
            XNamespace packageRel =
                "http://schemas.openxmlformats.org/package/2006/relationships";

            var firstSheet = workbook
                .Descendants(main + "sheet")
                .FirstOrDefault();
            var relationId =
                firstSheet?.Attribute(relDoc + "id")?.Value;
            if (string.IsNullOrWhiteSpace(relationId))
                return FileError(
                    "XLSX_SHEET",
                    "worksheet قابل خواندن در فایل پیدا نشد.");

            var target = rels
                .Descendants(packageRel + "Relationship")
                .FirstOrDefault(x =>
                    string.Equals(
                        x.Attribute("Id")?.Value,
                        relationId,
                        StringComparison.Ordinal))
                ?.Attribute("Target")?.Value;
            if (string.IsNullOrWhiteSpace(target))
                return FileError(
                    "XLSX_SHEET",
                    "مسیر worksheet فایل معتبر نیست.");

            var worksheetPath = NormalizeWorksheetPath(target);
            if (worksheetPath is null)
                return FileError(
                    "XLSX_SHEET",
                    "مسیر worksheet فایل معتبر نیست.");

            var sheetEntry = archive.GetEntry(worksheetPath);
            if (sheetEntry is null)
                return FileError(
                    "XLSX_SHEET",
                    "worksheet فایل قابل خواندن نیست.");

            var sharedStrings = ReadSharedStrings(archive, main);
            var sheet = LoadXml(sheetEntry);
            var rows = new List<TabularRow>();

            foreach (var rowElement in sheet.Descendants(main + "row"))
            {
                var rowNumber = ParsePositiveInt(
                    rowElement.Attribute("r")?.Value,
                    rows.Count + 1);
                var cells = new Dictionary<int, OrganizationRecipientImportCell>();

                foreach (var cell in rowElement.Elements(main + "c"))
                {
                    var reference = cell.Attribute("r")?.Value;
                    var column = ColumnIndex(reference);
                    if (column is < 0 or > 50)
                        continue;

                    var hasFormula = cell.Element(main + "f") is not null;
                    var type = cell.Attribute("t")?.Value;
                    var value = ReadXlsxCell(
                        cell,
                        type,
                        sharedStrings,
                        main);
                    cells[column] =
                        new OrganizationRecipientImportCell(
                            value,
                            IsText: type is "s" or "inlineStr" or "str",
                            HasFormula: hasFormula);
                }

                if (cells.Count == 0)
                    continue;

                var width = cells.Keys.Max() + 1;
                var values =
                    new OrganizationRecipientImportCell[width];
                for (var i = 0; i < width; i++)
                    values[i] = cells.TryGetValue(i, out var cell)
                        ? cell
                        : new OrganizationRecipientImportCell(
                            string.Empty,
                            IsText: true,
                            HasFormula: false);

                rows.Add(new TabularRow(rowNumber, values));
            }

            return MapTabularRows(rows);
        }
        catch (InvalidDataException)
        {
            return FileError(
                "XLSX_FORMAT",
                "فایل XLSX معتبر نیست.");
        }
        catch (System.Xml.XmlException)
        {
            return FileError(
                "XLSX_XML",
                "ساختار XML فایل XLSX معتبر نیست.");
        }
    }

    private static XDocument LoadXml(ZipArchiveEntry entry)
    {
        using var stream = entry.Open();
        return XDocument.Load(stream, LoadOptions.None);
    }

    private static IReadOnlyList<string> ReadSharedStrings(
        ZipArchive archive,
        XNamespace main)
    {
        var entry = archive.GetEntry("xl/sharedStrings.xml");
        if (entry is null)
            return Array.Empty<string>();

        var document = LoadXml(entry);
        return document
            .Descendants(main + "si")
            .Select(si => string.Concat(
                si.Descendants(main + "t")
                    .Select(t => t.Value)))
            .ToArray();
    }

    private static string ReadXlsxCell(
        XElement cell,
        string? type,
        IReadOnlyList<string> sharedStrings,
        XNamespace main)
    {
        if (type == "inlineStr")
            return string.Concat(
                cell.Descendants(main + "t").Select(t => t.Value));

        var raw = cell.Element(main + "v")?.Value ?? string.Empty;
        if (type == "s" &&
            int.TryParse(
                raw,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out var index) &&
            index >= 0 &&
            index < sharedStrings.Count)
            return sharedStrings[index];

        return raw;
    }

    private static string? NormalizeWorksheetPath(string target)
    {
        var normalized = target.Replace('\\', '/').TrimStart('/');
        if (normalized.StartsWith("../", StringComparison.Ordinal) ||
            normalized.Contains("/../", StringComparison.Ordinal))
            return null;
        if (normalized.StartsWith("xl/", StringComparison.Ordinal))
            return normalized;
        return "xl/" + normalized;
    }

    private static int ColumnIndex(string? reference)
    {
        if (string.IsNullOrWhiteSpace(reference))
            return -1;

        var value = 0;
        var letters = 0;
        foreach (var ch in reference)
        {
            if (letters >= 3)
                return -1;

            if (ch is >= 'A' and <= 'Z')
            {
                value = value * 26 + (ch - 'A' + 1);
                letters++;
            }
            else if (ch is >= 'a' and <= 'z')
            {
                value = value * 26 + (ch - 'a' + 1);
                letters++;
            }
            else
            {
                break;
            }
        }

        return letters == 0 ? -1 : value - 1;
    }

    private static int ParsePositiveInt(string? value, int fallback) =>
        int.TryParse(
            value,
            NumberStyles.None,
            CultureInfo.InvariantCulture,
            out var parsed) &&
        parsed > 0
            ? parsed
            : fallback;

    private sealed record TabularRow(
        int RowNumber,
        IReadOnlyList<OrganizationRecipientImportCell> Cells);

    private static OrganizationRecipientImportParseResult MapTabularRows(
        IReadOnlyList<TabularRow> input)
    {
        var nonEmpty = input
            .Where(row => row.Cells.Any(cell =>
                !string.IsNullOrWhiteSpace(cell.Value)))
            .ToArray();
        if (nonEmpty.Length == 0)
            return FileError(
                "EMPTY_FILE",
                "فایل هیچ ردیف قابل پردازشی ندارد.");

        var header = nonEmpty[0];
        var headerMap = new Dictionary<string, int>(
            StringComparer.Ordinal);
        var errors = new List<OrganizationRecipientImportError>();

        for (var i = 0; i < header.Cells.Count; i++)
        {
            var name = CanonicalHeader(header.Cells[i].Value);
            if (name is null)
            {
                if (!string.IsNullOrWhiteSpace(header.Cells[i].Value))
                    errors.Add(new(
                        header.RowNumber,
                        "file",
                        "UNKNOWN_COLUMN",
                        "فایل شامل ستون ناشناخته است."));
                continue;
            }

            if (!headerMap.TryAdd(name, i))
                errors.Add(new(
                    header.RowNumber,
                    name,
                    "DUPLICATE_COLUMN",
                    "هر ستون فقط یک‌بار مجاز است."));
        }

        var mappedColumns = headerMap.Values.ToHashSet();
        foreach (var row in nonEmpty.Skip(1))
        {
            for (var i = 0; i < row.Cells.Count; i++)
            {
                if (!mappedColumns.Contains(i) &&
                    !string.IsNullOrWhiteSpace(row.Cells[i].Value))
                    errors.Add(new(
                        row.RowNumber,
                        "file",
                        "UNMAPPED_COLUMN_DATA",
                        "داده در ستونی خارج از قالب مجاز وجود دارد."));
            }
        }

        foreach (var required in new[]
        {
            "displayName", "externalReference", "phone"
        })
        {
            if (!headerMap.ContainsKey(required))
                errors.Add(new(
                    header.RowNumber,
                    required,
                    "MISSING_COLUMN",
                    "ستون الزامی در فایل وجود ندارد."));
        }

        if (errors.Count > 0)
            return new(Array.Empty<OrganizationRecipientImportRow>(), errors);

        var rows = new List<OrganizationRecipientImportRow>();
        foreach (var row in nonEmpty.Skip(1))
        {
            if (rows.Count >= MaxRows)
            {
                errors.Add(new(
                    row.RowNumber,
                    "file",
                    "ROW_LIMIT",
                    "حداکثر ۵۰۰ ردیف داده در هر فایل مجاز است."));
                break;
            }

            OrganizationRecipientImportCell Cell(string name)
            {
                var index = headerMap[name];
                return index < row.Cells.Count
                    ? row.Cells[index]
                    : new OrganizationRecipientImportCell(
                        string.Empty,
                        IsText: true,
                        HasFormula: false);
            }

            var displayName = Cell("displayName");
            var reference = Cell("externalReference");
            var phone = Cell("phone");

            foreach (var (field, cell) in new[]
            {
                ("displayName", displayName),
                ("externalReference", reference),
                ("phone", phone)
            })
            {
                if (cell.HasFormula)
                    errors.Add(new(
                        row.RowNumber,
                        field,
                        "FORMULA_NOT_ALLOWED",
                        "سلول فرمول‌دار در فایل ورودی مجاز نیست."));
            }

            if (!displayName.IsText &&
                !string.IsNullOrWhiteSpace(displayName.Value))
                errors.Add(new(
                    row.RowNumber,
                    "displayName",
                    "TEXT_REQUIRED",
                    "نام نمایشی در XLSX باید به‌صورت متن ذخیره شود."));

            if (!reference.IsText &&
                !string.IsNullOrWhiteSpace(reference.Value))
                errors.Add(new(
                    row.RowNumber,
                    "externalReference",
                    "TEXT_REQUIRED",
                    "شناسه موردنیاز در XLSX باید به‌صورت متن ذخیره شود تا صفرهای ابتدایی از بین نرود."));

            if (!phone.IsText &&
                !string.IsNullOrWhiteSpace(phone.Value))
                errors.Add(new(
                    row.RowNumber,
                    "phone",
                    "TEXT_REQUIRED",
                    "شماره همراه در XLSX باید به‌صورت متن ذخیره شود."));

            rows.Add(new(
                row.RowNumber,
                displayName,
                reference,
                phone));
        }

        if (rows.Count == 0 && errors.Count == 0)
            errors.Add(new(
                header.RowNumber,
                "file",
                "NO_DATA_ROWS",
                "فایل باید حداقل یک ردیف داده داشته باشد."));

        return new(rows, errors);
    }

    private static string? CanonicalHeader(string raw)
    {
        var value = raw.Trim().TrimStart('\uFEFF');
        return value switch
        {
            "displayName" or "نام" or "نام و عنوان نمایشی" =>
                "displayName",
            "externalReference" or "شناسه" or "شناسه موردنیاز" =>
                "externalReference",
            "phone" or "شماره همراه" or "شماره تلفن همراه" =>
                "phone",
            _ => null
        };
    }

    private static OrganizationRecipientImportParseResult FileError(
        string code,
        string message) =>
        new(
            Array.Empty<OrganizationRecipientImportRow>(),
            [new OrganizationRecipientImportError(
                0,
                "file",
                code,
                message)]);
}
