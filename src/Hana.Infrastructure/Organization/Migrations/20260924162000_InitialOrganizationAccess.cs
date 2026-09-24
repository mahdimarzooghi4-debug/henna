using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260924162000_InitialOrganizationAccess")]
public sealed class InitialOrganizationAccess : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "organization");

        migrationBuilder.CreateTable(
            name: "organizations", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(200)",
                    maxLength: 200, nullable: false),
                organization_type = table.Column<string>(
                    type: "character varying(80)", maxLength: 80, nullable: false),
                default_allocation_method = table.Column<string>(
                    type: "character varying(120)", maxLength: 120, nullable: false),
                phone = table.Column<string>(type: "character varying(32)",
                    maxLength: 32, nullable: true),
                email = table.Column<string>(type: "character varying(254)",
                    maxLength: 254, nullable: true),
                address = table.Column<string>(type: "character varying(500)",
                    maxLength: 500, nullable: true),
                representative_name = table.Column<string>(
                    type: "character varying(160)", maxLength: 160, nullable: true),
                representative_phone = table.Column<string>(
                    type: "character varying(32)", maxLength: 32, nullable: true),
                verified_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: true),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                updated_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_organizations", x => x.id);
                table.CheckConstraint("ck_organizations_name",
                    "length(btrim(name)) > 0");
                table.CheckConstraint("ck_organizations_type",
                    "length(btrim(organization_type)) > 0");
                table.CheckConstraint("ck_organizations_allocation_method",
                    "length(btrim(default_allocation_method)) > 0");
            });

        migrationBuilder.CreateTable(
            name: "memberships", schema: "organization",
            columns: table => new
            {
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                role = table.Column<string>(type: "character varying(64)",
                    maxLength: 64, nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_organization_memberships",
                    x => new { x.organization_id, x.account_id });
                table.CheckConstraint("ck_organization_membership_role",
                    "length(btrim(role)) > 0");
                table.ForeignKey("fk_organization_memberships_organizations",
                    x => x.organization_id,
                    principalSchema: "organization", principalTable: "organizations",
                    principalColumn: "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("fk_organization_memberships_identity_accounts",
                    x => x.account_id,
                    principalSchema: "identity", principalTable: "accounts",
                    principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "ix_organizations_active_name",
            schema: "organization", table: "organizations",
            columns: new[] { "is_active", "name", "id" });

        migrationBuilder.CreateIndex(
            name: "ix_organization_memberships_active_account",
            schema: "organization", table: "memberships",
            column: "account_id", unique: true,
            filter: "is_active = TRUE");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "memberships", schema: "organization");
        migrationBuilder.DropTable(name: "organizations", schema: "organization");
    }
}
