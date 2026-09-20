using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Identity.Migrations;

[DbContext(typeof(HanaIdentityDbContext))]
[Migration("20260920223000_AuthSessions")]
public sealed class AuthSessions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "auth_sessions",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                account_id = table.Column<Guid>(type: "uuid", nullable: false),
                token_digest = table.Column<byte[]>(type: "bytea", maxLength: 32,
                    nullable: false),
                issued_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                revoked_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_auth_sessions", x => x.id);
                table.ForeignKey("fk_auth_sessions_accounts_account_id",
                    x => x.account_id,
                    principalSchema: "identity",
                    principalTable: "accounts",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
                table.CheckConstraint("ck_auth_sessions_expiry",
                    "expires_at_utc > issued_at_utc");
                table.CheckConstraint("ck_auth_sessions_revocation",
                    "revoked_at_utc IS NULL OR revoked_at_utc >= issued_at_utc");
            });

        migrationBuilder.CreateIndex(
            name: "ix_auth_sessions_account_expiry",
            schema: "identity", table: "auth_sessions",
            columns: new[] { "account_id", "expires_at_utc" });

        migrationBuilder.CreateIndex(
            name: "ix_auth_sessions_digest",
            schema: "identity", table: "auth_sessions",
            column: "token_digest", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "auth_sessions", schema: "identity");
    }
}
