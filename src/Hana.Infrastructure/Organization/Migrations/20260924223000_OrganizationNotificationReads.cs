using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924223000_OrganizationNotificationReads")]
public sealed class OrganizationNotificationReads : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "notification_reads",
            schema: "organization",
            columns: table => new
            {
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                program_id = table.Column<Guid>(type: "uuid", nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                read_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_notification_reads", x =>
                    new { x.organization_id, x.program_id, x.account_id });
                table.ForeignKey(
                    name: "fk_notification_reads_programs",
                    columns: x => new { x.program_id, x.organization_id },
                    principalSchema: "organization",
                    principalTable: "programs",
                    principalColumns: new[] { "id", "organization_id" },
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "fk_notification_reads_memberships",
                    columns: x => new { x.organization_id, x.account_id },
                    principalSchema: "organization",
                    principalTable: "memberships",
                    principalColumns: new[] { "organization_id", "account_id" },
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_notification_reads_program_org",
            schema: "organization",
            table: "notification_reads",
            columns: new[] { "program_id", "organization_id" });
        migrationBuilder.CreateIndex(
            name: "ix_notification_reads_org_account",
            schema: "organization",
            table: "notification_reads",
            columns: new[] { "organization_id", "account_id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "notification_reads", schema: "organization");
    }
}
