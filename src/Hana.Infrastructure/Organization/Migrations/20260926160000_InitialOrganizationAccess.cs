using Hana.Infrastructure.Organization;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Organization.Migrations;

[DbContext(typeof(HanaOrganizationDbContext))]
[Migration("20260926160000_InitialOrganizationAccess")]
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
                name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                created_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                creation_key = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_organizations", x => x.id);
                table.CheckConstraint("ck_organizations_name", "char_length(btrim(name)) BETWEEN 1 AND 160");
            });
        migrationBuilder.CreateTable(
            name: "memberships", schema: "organization",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                role = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                granted_by_account_id = table.Column<Guid>(type: "uuid", nullable: false),
                granted_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                revoked_by_account_id = table.Column<Guid>(type: "uuid", nullable: true),
                revoked_at_utc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                grant_key = table.Column<Guid>(type: "uuid", nullable: false),
                revoke_key = table.Column<Guid>(type: "uuid", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_memberships", x => x.id);
                table.CheckConstraint("ck_organization_memberships_role", "role IN ('ORG_LEAD','ORG_REPRESENTATIVE','ORG_TECHNICAL_OPERATOR')");
                table.CheckConstraint("ck_organization_memberships_revocation", "(revoked_at_utc IS NULL AND revoked_by_account_id IS NULL) OR (revoked_at_utc IS NOT NULL AND revoked_by_account_id IS NOT NULL AND revoked_at_utc >= granted_at_utc)");
                table.ForeignKey("fk_organization_memberships_organizations", x => x.organization_id,
                    principalSchema: "organization", principalTable: "organizations",
                    principalColumn: "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex(name: "ix_organizations_name", schema: "organization", table: "organizations", column: "name");
        migrationBuilder.CreateIndex(name: "ux_organizations_creation_key", schema: "organization", table: "organizations", column: "creation_key", unique: true);
        migrationBuilder.CreateIndex(name: "ix_organization_memberships_org_account", schema: "organization", table: "memberships", columns: new[] { "organization_id", "account_id" });
        migrationBuilder.CreateIndex(name: "ux_organization_memberships_active_account", schema: "organization", table: "memberships", columns: new[] { "organization_id", "account_id" }, unique: true, filter: "revoked_at_utc IS NULL");
        migrationBuilder.CreateIndex(name: "ux_organization_memberships_grant_key", schema: "organization", table: "memberships", column: "grant_key", unique: true);
        migrationBuilder.CreateIndex(name: "ux_organization_memberships_revoke_key", schema: "organization", table: "memberships", column: "revoke_key", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "memberships", schema: "organization");
        migrationBuilder.DropTable(name: "organizations", schema: "organization");
    }
}
