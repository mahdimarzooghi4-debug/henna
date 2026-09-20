using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Identity.Migrations;

[DbContext(typeof(HanaIdentityDbContext))]
[Migration("20260920233000_OtpIpThrottle")]
public sealed class OtpIpThrottle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "otp_ip_windows",
            schema: "identity",
            columns: table => new
            {
                partition_digest = table.Column<byte[]>(type: "bytea",
                    maxLength: 32, nullable: false),
                action = table.Column<string>(type: "character varying(8)",
                    maxLength: 8, nullable: false),
                window_started_at_utc = table.Column<DateTimeOffset>(
                    type: "timestamp with time zone", nullable: false),
                request_count = table.Column<int>(type: "integer",
                    nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("pk_otp_ip_windows",
                    x => new { x.partition_digest, x.action });
                table.CheckConstraint("ck_otp_ip_windows_action",
                    "action IN ('REQUEST', 'VERIFY')");
                table.CheckConstraint("ck_otp_ip_windows_count",
                    "request_count >= 1");
            });

        migrationBuilder.CreateIndex(
            name: "ix_otp_ip_windows_started",
            schema: "identity", table: "otp_ip_windows",
            column: "window_started_at_utc");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "otp_ip_windows", schema: "identity");
    }
}
