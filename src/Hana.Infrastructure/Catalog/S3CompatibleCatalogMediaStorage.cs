using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace Hana.Infrastructure.Catalog;

public sealed record CatalogMediaStorageOptions(
    Uri Endpoint, string Region, string Bucket, string AccessKeyId, string SecretAccessKey)
{
    public static CatalogMediaStorageOptions? Load(
        IConfiguration configuration, bool allowHttp)
    {
        var section = configuration.GetSection("CatalogMedia");
        var endpointText = section["Endpoint"];
        var region = section["Region"];
        var bucket = section["Bucket"];
        var accessKey = section["AccessKeyId"];
        var secretKey = section["SecretAccessKey"];
        var values = new[] { endpointText, region, bucket, accessKey, secretKey };
        if (values.All(string.IsNullOrWhiteSpace)) return null;
        if (values.Any(string.IsNullOrWhiteSpace) ||
            !Uri.TryCreate(endpointText, UriKind.Absolute, out var endpoint) ||
            (endpoint.Scheme != Uri.UriSchemeHttps &&
             !(allowHttp && endpoint.Scheme == Uri.UriSchemeHttp)) ||
            !string.IsNullOrEmpty(endpoint.UserInfo) ||
            !string.IsNullOrEmpty(endpoint.Query) ||
            !string.IsNullOrEmpty(endpoint.Fragment) ||
            endpoint.AbsolutePath != "/" ||
            bucket!.Length > 63 ||
            bucket.Any(c => !(char.IsAsciiLetterOrDigit(c) || c is '-' or '.')) ||
            region!.Length > 64 || accessKey!.Length > 256 ||
            secretKey!.Length > 512)
            throw new InvalidOperationException(
                "Catalog media storage configuration is invalid.");
        return new(endpoint, region, bucket, accessKey, secretKey);
    }
}

public interface ICatalogMediaStorage
{
    Task PutAsync(string key, string contentType, byte[] bytes,
        CancellationToken cancellationToken);
    Task<byte[]?> ReadAsync(string key, CancellationToken cancellationToken);
}

public sealed class S3CompatibleCatalogMediaStorage(
    IAmazonS3 client, CatalogMediaStorageOptions options)
    : ICatalogMediaStorage
{
    public async Task PutAsync(string key, string contentType, byte[] bytes,
        CancellationToken cancellationToken)
    {
        ValidateKey(key);
        await using var stream = new MemoryStream(bytes, writable: false);
        await client.PutObjectAsync(new PutObjectRequest
        {
            BucketName = options.Bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
            AutoCloseStream = false
        }, cancellationToken);
    }

    public async Task<byte[]?> ReadAsync(string key,
        CancellationToken cancellationToken)
    {
        ValidateKey(key);
        try
        {
            using var response = await client.GetObjectAsync(
                options.Bucket, key, cancellationToken);
            if (response.ContentLength < 0 ||
                response.ContentLength > CatalogMediaStorageLimits.MaxImageBytes)
                throw new InvalidDataException("Stored image length is invalid.");
            await using var output = new MemoryStream((int)response.ContentLength);
            var buffer = new byte[64 * 1024];
            while (output.Length <= CatalogMediaStorageLimits.MaxImageBytes)
            {
                var read = await response.ResponseStream.ReadAsync(buffer,
                    cancellationToken);
                if (read == 0) break;
                if (output.Length + read > CatalogMediaStorageLimits.MaxImageBytes)
                    throw new InvalidDataException("Stored image exceeds limit.");
                await output.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
            }
            if (output.Length != response.ContentLength)
                throw new InvalidDataException(
                    "Stored image length did not match metadata.");
            return output.ToArray();
        }
        catch (AmazonS3Exception ex) when (
            ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    private static void ValidateKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 300 ||
            key.StartsWith('/') || key.Contains("..", StringComparison.Ordinal) ||
            !key.StartsWith("catalog/", StringComparison.Ordinal))
            throw new ArgumentException("Invalid catalog media key.", nameof(key));
    }
}

public static class S3CompatibleCatalogMediaRegistration
{
    public static void AddCatalogMediaStorage(
        this IServiceCollection services,
        CatalogMediaStorageOptions options)
    {
        services.AddSingleton(options);
        services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKeyId,
                options.SecretAccessKey),
            new AmazonS3Config
            {
                ServiceURL = options.Endpoint.ToString().TrimEnd('/'),
                ForcePathStyle = true,
                AuthenticationRegion = options.Region,
            }));
        services.AddSingleton<ICatalogMediaStorage,
            S3CompatibleCatalogMediaStorage>();
    }
}

