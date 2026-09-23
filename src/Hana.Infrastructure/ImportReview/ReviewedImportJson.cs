using System.Text.Json;

namespace Hana.Infrastructure.ImportReview;

/// <summary>
/// For an operator-reviewed document, each JSON object must have one
/// unambiguous interpretation. System.Text.Json deserialization otherwise
/// accepts duplicate property names and uses the last occurrence: a human
/// reviewer and the importer may interpret different publication states.
/// Run before the EF transaction, preview digest or success receipt.
/// </summary>
public static class ReviewedImportJson
{
    public static void RejectDuplicateProperties(string json)
    {
        // The two importers already enforce their own byte limits. Match
        // their serializer depth and strict JSON grammar (no comments or
        // trailing commas); parsed property.Name decodes \u escapes, so
        // "state" and "st\u0061te" are detected as the same name.
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions
        {
            MaxDepth = 12,
            CommentHandling = JsonCommentHandling.Disallow,
            AllowTrailingCommas = false
        });
        Check(document.RootElement);
    }

    private static void Check(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var property in element.EnumerateObject())
            {
                if (!seen.Add(property.Name))
                    throw new JsonException(
                        "Duplicate JSON property in reviewed import: " +
                        property.Name);
                Check(property.Value);
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in element.EnumerateArray())
                Check(child);
        }
    }
}
