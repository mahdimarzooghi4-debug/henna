using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Identity.Migrations;

[DbContext(typeof(HanaIdentityDbContext))]
[Migration("20260925170000_AdminRoleAssignments")]
public sealed class AdminRoleAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "role_assignments",
            schema: "identity",
            columns: table => new
            {
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                role = table.Column<string>(type: "character varying(32)",
                    maxLength: 32, nullable: false),
                granted_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_role_assignments",
                    x => new { x.account_id, x.role });
                table.CheckConstraint("ck_role_assignments_role",
                    "role IN ('ADMIN')");
                table.ForeignKey(
                    name: "fk_role_assignments_accounts_account_id",
                    column: x => x.account_id,
                    principalSchema: "identity",
                    principalTable: "accounts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "role_assignments",
            schema: "identity");
    }
}
