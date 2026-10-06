using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Hana.Application.Time;
using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Npgsql;

namespace Hana.Infrastructure.CreditLearning;

public sealed class AllocationRetentionEventRecord
{
    public Guid Id { get; set; }
    public Guid ActorAccountId { get; set; }
    public string Scope { get; set; } = "";
    public DateTimeOffset CutoffUtc { get; set; }
    public string PreviewDigest { get; set; } = "";
    public int DeletedSnapshotCount { get; set; }
    public int DeletedOutcomeCount { get; set; }
    public string Reason { get; set; } = "";
    public DateTimeOffset RecordedAtUtc { get; set; }
}

public sealed record AllocationRetentionPreview(
    string Scope,
    DateTimeOffset CutoffUtc,
    long TotalEligibleSnapshotCount,
    int SelectedSnapshotCount,
    int SelectedOutcomeCount,
    bool Truncated,
    string PreviewDigest);

public sealed record AllocationRetentionResult(
    Guid EventId,
    int DeletedSnapshotCount,
    int DeletedOutcomeCount,
    string PreviewDigest);

public sealed class AllocationRetentionConflictException(string message)
    : Exception(message) { }

/// <summary>
/// Explicit privileged retention for attributed research-only data.
/// First-party operational lineage and anything consumed by labels,
/// training or proposals are never eligible for this purge scope.
/// </summary>
public sealed class AllocationRetentionService(
    HanaAllocationLearningDbContext db,
    RoleAuthorizationService roles,
    IClock clock)
{
    public const string AttributedResearchScope = "ATTRIBUTED_RESEARCH";
    public const int BatchLimit = 5000;
    private const long RetentionLockKey = 48710261007;

    public async Task<AllocationRetentionPreview> PreviewAsync(
        Guid actor,
        DateTimeOffset cutoffUtc,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ValidateCutoff(cutoffUtc);
        return await BuildPreviewAsync(cutoffUtc, ct);
    }

    public async Task<AllocationRetentionResult> PurgeAsync(
        Guid actor,
        DateTimeOffset cutoffUtc,
        string previewDigest,
        string reason,
        CancellationToken ct = default)
    {
        await RequireAdmin(actor, ct);
        ValidateCutoff(cutoffUtc);
        if (string.IsNullOrWhiteSpace(previewDigest) ||
            previewDigest.Length != 64 ||
            previewDigest.Any(x => !Uri.IsHexDigit(x)))
            throw new ArgumentException("A 64-character preview digest is required.");
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 2000)
            throw new ArgumentException(
                "Retention reason must contain 1–2000 characters.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlRawAsync(
            $"SELECT pg_advisory_xact_lock({RetentionLockKey})", ct);

        var preview = await BuildPreviewAsync(cutoffUtc, ct);
        if (!string.Equals(
                preview.PreviewDigest,
                previewDigest,
                StringComparison.OrdinalIgnoreCase))
            throw new AllocationRetentionConflictException(
                "Retention preview changed; review the current eligible set before purging.");
        if (preview.SelectedSnapshotCount == 0)
            throw new AllocationRetentionConflictException(
                "No attributed research snapshots are eligible for retention purge.");

        var ids = await ReadEligibleIdsAsync(cutoffUtc, BatchLimit, ct);
        var idArray = ids.Ids.ToArray();
        var deletedOutcomes = await db.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM allocation_learning.outcomes
            WHERE "SnapshotId" = ANY({idArray})
            """, ct);
        if (deletedOutcomes != preview.SelectedOutcomeCount)
            throw new AllocationRetentionConflictException(
                "Outcome set changed during retention purge.");

        var deletedSnapshots = await db.Database.ExecuteSqlInterpolatedAsync($"""
            DELETE FROM allocation_learning.assessments
            WHERE "Id" = ANY({idArray})
            """, ct);
        if (deletedSnapshots != preview.SelectedSnapshotCount)
            throw new AllocationRetentionConflictException(
                "Assessment set changed during retention purge.");

        var eventId = Guid.NewGuid();
        db.RetentionEvents.Add(new()
        {
            Id = eventId,
            ActorAccountId = actor,
            Scope = AttributedResearchScope,
            CutoffUtc = cutoffUtc,
            PreviewDigest = preview.PreviewDigest.ToLowerInvariant(),
            DeletedSnapshotCount = deletedSnapshots,
            DeletedOutcomeCount = deletedOutcomes,
            Reason = reason.Trim(),
            RecordedAtUtc = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new(
            eventId,
            deletedSnapshots,
            deletedOutcomes,
            preview.PreviewDigest.ToLowerInvariant());
    }

    private async Task<AllocationRetentionPreview> BuildPreviewAsync(
        DateTimeOffset cutoffUtc,
        CancellationToken ct)
    {
        var selection = await ReadEligibleIdsAsync(
            cutoffUtc, BatchLimit, ct);
        var ids = selection.Ids.ToArray();
        var outcomeCount = ids.Length == 0
            ? 0
            : await db.Outcomes.AsNoTracking()
                .CountAsync(x => ids.Contains(x.SnapshotId), ct);
        var digest = PreviewDigest(cutoffUtc, ids);

        return new(
            AttributedResearchScope,
            cutoffUtc,
            selection.TotalCount,
            ids.Length,
            outcomeCount,
            selection.TotalCount > ids.Length,
            digest);
    }

    private async Task<(IReadOnlyList<Guid> Ids, long TotalCount)>
        ReadEligibleIdsAsync(
            DateTimeOffset cutoffUtc,
            int limit,
            CancellationToken ct)
    {
        var connection = (NpgsqlConnection)db.Database.GetDbConnection();
        var openedHere = connection.State != ConnectionState.Open;
        if (openedHere) await connection.OpenAsync(ct);
        try
        {
            await using var command = connection.CreateCommand();
            if (db.Database.CurrentTransaction is { } current)
                command.Transaction = (NpgsqlTransaction)current.GetDbTransaction();
            command.CommandText = """
                SELECT a."Id", count(*) OVER() AS "TotalCount"
                FROM allocation_learning.assessments a
                WHERE a."RecordedByAccountId" IS NOT NULL
                  AND a."EvidenceReference" IS NOT NULL
                  AND a."RecordedAtUtc" <= @cutoff
                  AND a."RuntimeProposalId" IS NULL
                  AND a."RuntimeProfileSequence" IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM allocation_learning.need_labels l
                      WHERE l."SnapshotId" = a."Id"
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM allocation_learning.proposals p
                      WHERE EXISTS (
                          SELECT 1
                          FROM jsonb_array_elements_text(p."SnapshotIdsJson") s(value)
                          WHERE s.value = a."Id"::text
                      )
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM allocation_learning.training_runs t
                      WHERE EXISTS (
                          SELECT 1
                          FROM jsonb_array_elements_text(
                              t."InputsJson" -> 'snapshotIds') s(value)
                          WHERE s.value = a."Id"::text
                      )
                  )
                ORDER BY a."RecordedAtUtc", a."Id"
                LIMIT @limit;
                """;
            command.Parameters.AddWithValue("cutoff", cutoffUtc);
            command.Parameters.AddWithValue("limit", limit);

            var ids = new List<Guid>(Math.Min(limit, 512));
            long total = 0;
            await using var reader = await command.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                ids.Add(reader.GetGuid(0));
                total = reader.GetInt64(1);
            }

            return (ids.AsReadOnly(), total);
        }
        finally
        {
            if (openedHere) await connection.CloseAsync();
        }
    }

    private static string PreviewDigest(
        DateTimeOffset cutoffUtc,
        IReadOnlyCollection<Guid> ids)
    {
        var canonical = new StringBuilder()
            .Append(AttributedResearchScope)
            .Append('|')
            .Append(cutoffUtc.ToString("O", CultureInfo.InvariantCulture));
        foreach (var id in ids.OrderBy(x => x))
            canonical.Append('|').Append(id.ToString("D"));
        return Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(canonical.ToString())))
            .ToLowerInvariant();
    }

    private void ValidateCutoff(DateTimeOffset cutoffUtc)
    {
        if (cutoffUtc.Offset != TimeSpan.Zero || cutoffUtc > clock.UtcNow)
            throw new ArgumentException(
                "Retention cutoff must be an explicit past UTC timestamp.");
    }

    private async Task RequireAdmin(Guid actor, CancellationToken ct)
    {
        if (actor == Guid.Empty ||
            !await roles.HasRoleAsync(actor, HanaRoles.Admin, ct))
            throw new UnauthorizedAccessException(
                "Explicit administrator assignment required.");
    }
}
