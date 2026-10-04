using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
namespace Hana.Infrastructure.Commerce.Migrations;
[DbContext(typeof(HanaCommerceDbContext))]
public sealed class HanaCommerceDbContextModelSnapshot : ModelSnapshot
{
 protected override void BuildModel(ModelBuilder b) {
 b.HasDefaultSchema("commerce");b.HasAnnotation("ProductVersion","10.0.0");b.HasAnnotation("Relational:MaxIdentifierLength",63);b.UseIdentityByDefaultColumns();
 b.Entity("Hana.Infrastructure.Commerce.CommerceDocument",e=>{
 e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");e.Property<Guid>("OwnerId").HasColumnType("uuid");e.Property<string>("Kind").IsRequired().HasMaxLength(32).HasColumnType("character varying(32)");e.Property<string>("Body").IsRequired().HasColumnType("jsonb");e.Property<int>("Revision").IsConcurrencyToken().HasColumnType("integer");e.HasKey("Id");e.HasIndex("Kind","OwnerId","Id");e.ToTable("documents","commerce",t=>t.HasCheckConstraint("ck_document_revision","\"Revision\" > 0"));});
 b.Entity("Hana.Infrastructure.Commerce.CommerceCommandReceipt",e=>{
 e.Property<Guid>("ActorId").HasColumnType("uuid");e.Property<Guid>("CommandId").HasColumnType("uuid");e.Property<string>("Fingerprint").IsRequired().HasMaxLength(64).HasColumnType("character varying(64)");e.Property<string>("ResultJson").IsRequired().HasColumnType("jsonb");e.Property<DateTimeOffset>("CreatedAtUtc").HasColumnType("timestamp with time zone");e.HasKey("ActorId","CommandId");e.ToTable("command_receipts","commerce");});
 b.Entity("Hana.Infrastructure.Commerce.CommerceJournal",e=>{
 e.Property<Guid>("Id").ValueGeneratedNever().HasColumnType("uuid");e.Property<Guid>("ActorId").HasColumnType("uuid");e.Property<Guid>("CommandId").HasColumnType("uuid");e.Property<Guid>("ResourceId").HasColumnType("uuid");e.Property<string>("Event").IsRequired().HasMaxLength(64).HasColumnType("character varying(64)");e.Property<string>("Body").IsRequired().HasColumnType("jsonb");e.Property<DateTimeOffset>("CreatedAtUtc").HasColumnType("timestamp with time zone");e.HasKey("Id");e.HasIndex("ResourceId","CreatedAtUtc");e.ToTable("journal","commerce");});
 }
}
