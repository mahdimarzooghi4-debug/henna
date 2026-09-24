namespace Hana.Infrastructure.Organization;

public sealed class OrganizationRecipientImportRecord
{
    public Guid OrganizationId { get; set; }
    public Guid ImportKey { get; set; }
    public Guid ProgramId { get; set; }
    public string BatchFingerprint { get; set; } = null!;
    public int RowCount { get; set; }
    public Guid CreatedByAccountId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}
