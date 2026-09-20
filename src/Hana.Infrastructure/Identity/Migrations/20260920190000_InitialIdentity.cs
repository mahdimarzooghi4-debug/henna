using Hana.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Identity.Migrations;

[DbContext(typeof(HanaIdentityDbContext))]
[Migration("20260920190000_InitialIdentity")]
public sealed class InitialIdentity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.EnsureSchema(name: "identity");

        migrationBuilder.CreateTable(
            name: "accounts",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                normalized_phone = table.Column<string>(type: "character varying(11)",
                    maxLength: 11, nullable: false),
                created_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                phone_verified_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: true)
            },
            constraints: table => table.PrimaryKey("pk_accounts", x => x.id));

        migrationBuilder.CreateIndex(
            name: "ix_accounts_normalized_phone",
            schema: "identity",
            table: "accounts",
            column: "normalized_phone",
            unique: true);

        migrationBuilder.CreateTable(
            name: "otp_challenges",
            schema: "identity",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                normalized_phone = table.Column<string>(type: "character varying(11)",
                    maxLength: 11, nullable: false),
                code_digest = table.Column<byte[]>(type: "bytea",
                    maxLength: 32, nullable: false),
                issued_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                expires_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                failed_attempt_count = table.Column<int>(type: "integer", nullable: false),
                consumed_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: true),
                provider_message_reference = table.Column<string>(
                    type: "character varying(160)", maxLength: 160, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_otp_challenges", x => x.id);
                table.CheckConstraint("ck_otp_challenges_attempts_nonnegative",
                    "failed_attempt_count >= 0");
                table.CheckConstraint("ck_otp_challenges_expiry",
                    "expires_at_utc > issued_at_utc");
            });

        migrationBuilder.CreateIndex(
            name: "ix_otp_challenges_phone_issued",
            schema: "identity",
            table: "otp_challenges",
            columns: new[] { "normalized_phone", "issued_at_utc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "otp_challenges", schema: "identity");
        migrationBuilder.DropTable(name: "accounts", schema: "identity");
    }
}
