using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace Hana.Infrastructure.Commerce.Migrations;
[DbContext(typeof(HanaCommerceDbContext))]
[Migration("20261004133000_InitialCommerce")]
public sealed class InitialCommerce : Migration
{
 protected override void Up(MigrationBuilder m)=>m.Sql("""
 CREATE SCHEMA IF NOT EXISTS commerce;
 CREATE TABLE commerce.documents (
 "Id" uuid PRIMARY KEY,"OwnerId" uuid NOT NULL,"Kind" varchar(32) NOT NULL,"Body" jsonb NOT NULL,"Revision" integer NOT NULL,
 CONSTRAINT ck_document_revision CHECK ("Revision">0));
 CREATE INDEX "IX_documents_Kind_OwnerId_Id" ON commerce.documents("Kind","OwnerId","Id");
 CREATE TABLE commerce.command_receipts (
 "ActorId" uuid NOT NULL,"CommandId" uuid NOT NULL,"Fingerprint" varchar(64) NOT NULL,"ResultJson" jsonb NOT NULL,"CreatedAtUtc" timestamptz NOT NULL,
 CONSTRAINT "PK_command_receipts" PRIMARY KEY("ActorId","CommandId"));
 CREATE TABLE commerce.journal (
 "Id" uuid PRIMARY KEY,"ActorId" uuid NOT NULL,"CommandId" uuid NOT NULL,"ResourceId" uuid NOT NULL,"Event" varchar(64) NOT NULL,"Body" jsonb NOT NULL,"CreatedAtUtc" timestamptz NOT NULL);
 CREATE INDEX "IX_journal_ResourceId_CreatedAtUtc" ON commerce.journal("ResourceId","CreatedAtUtc");
 """);
 protected override void Down(MigrationBuilder m)=>m.Sql("DROP TABLE commerce.journal; DROP TABLE commerce.command_receipts; DROP TABLE commerce.documents;");
}
