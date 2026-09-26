using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hana.Infrastructure.Identity.Migrations;

[DbContext(typeof(HanaIdentityDbContext))]
[Migration("20260926042000_SellerRoleAssignments")]
public sealed class SellerRoleAssignments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_role_assignments_role",
            schema: "identity",
            table: "role_assignments");

        migrationBuilder.AddCheckConstraint(
            name: "ck_role_assignments_role",
            schema: "identity",
            table: "role_assignments",
            sql: "role IN ('ADMIN','SELLER')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "ck_role_assignments_role",
            schema: "identity",
            table: "role_assignments");

        migrationBuilder.AddCheckConstraint(
            name: "ck_role_assignments_role",
            schema: "identity",
            table: "role_assignments",
            sql: "role IN ('ADMIN')");
    }
}
