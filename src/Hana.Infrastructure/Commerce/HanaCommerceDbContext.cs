using Microsoft.EntityFrameworkCore;
namespace Hana.Infrastructure.Commerce;
// Versioned aggregate documents; writes go through CommerceService's atomic command boundary.
public sealed class CommerceDocument
{
    public Guid Id { get; set; }
    public Guid OwnerId { get; set; }
    public string Kind { get; set; } = "";
    public string Body { get; set; } = "";
    public int Revision { get; set; }
}
public sealed class CommerceCommandReceipt
{
    public Guid ActorId { get; set; }
    public Guid CommandId { get; set; }
    public string Fingerprint { get; set; } = "";
    public string ResultJson { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
}
public sealed class CommerceJournal
{
    public Guid Id { get; set; }
    public Guid ActorId { get; set; }
    public Guid CommandId { get; set; }
    public Guid ResourceId { get; set; }
    public string Event { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; }
}
public sealed class HanaCommerceDbContext(DbContextOptions<HanaCommerceDbContext> options) : DbContext(options)
{
    public DbSet<CommerceDocument> Documents => Set<CommerceDocument>();
    public DbSet<CommerceCommandReceipt> Receipts => Set<CommerceCommandReceipt>();
    public DbSet<CommerceJournal> Journal => Set<CommerceJournal>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasDefaultSchema("commerce");
        b.Entity<CommerceDocument>(e => {
            e.ToTable("documents", t=>t.HasCheckConstraint("ck_document_revision","\"Revision\" > 0"));
            e.HasKey(x=>x.Id); e.Property(x=>x.Id).ValueGeneratedNever();
            e.Property(x=>x.Kind).HasMaxLength(32).IsRequired(); e.Property(x=>x.Body).HasColumnType("jsonb").IsRequired();
            e.Property(x=>x.Revision).IsConcurrencyToken(); e.HasIndex(x=>new{x.Kind,x.OwnerId,x.Id});
        });
        b.Entity<CommerceCommandReceipt>(e=>{
            e.ToTable("command_receipts"); e.HasKey(x=>new{x.ActorId,x.CommandId});
            e.Property(x=>x.Fingerprint).HasMaxLength(64).IsRequired(); e.Property(x=>x.ResultJson).HasColumnType("jsonb").IsRequired();
        });
        b.Entity<CommerceJournal>(e=>{
            e.ToTable("journal");e.HasKey(x=>x.Id);e.Property(x=>x.Id).ValueGeneratedNever();
            e.Property(x=>x.Event).HasMaxLength(64).IsRequired();e.Property(x=>x.Body).HasColumnType("jsonb").IsRequired();
            e.HasIndex(x=>new{x.ResourceId,x.CreatedAtUtc});
        });
    }
    private void ValidateWrites()
    {
        ChangeTracker.DetectChanges();
        if (ChangeTracker.Entries().Any(e=> (e.Entity is CommerceJournal or CommerceCommandReceipt) && (e.State is EntityState.Modified or EntityState.Deleted)))
            throw new InvalidOperationException("Commerce journal and receipts are append-only.");
    }
    public override int SaveChanges(bool acceptAllChangesOnSuccess) { ValidateWrites();return base.SaveChanges(acceptAllChangesOnSuccess); }
    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess,CancellationToken ct=default) { ValidateWrites();return base.SaveChangesAsync(acceptAllChangesOnSuccess,ct); }
}
