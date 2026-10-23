using System.Security.Cryptography;
using System.Text;
using Hana.Infrastructure.CreditLearning;
using Xunit;

namespace Hana.Infrastructure.Tests;

public sealed class AllocationModelArtifactAttestationTests
{
    [Fact]
    public void ResearchArtifactIsOnlyByteAttestedNeverModelApproved()
    {
        var data = Encoding.UTF8.GetBytes("local-henna-research-artifact");
        var digest = Convert.ToHexString(SHA256.HashData(data)).ToLowerInvariant();
        Assert.True(AllocationModelArtifactAttestation.Matches(data, digest));
        Assert.False(AllocationModelArtifactAttestation.Matches(
            Encoding.UTF8.GetBytes("tampered"), digest));
        Assert.False(AllocationModelArtifactAttestation.Matches(data, "0" + digest[1..]));
        Assert.False(AllocationModelArtifactAttestation.Matches(null, digest));
        Assert.False(AllocationModelArtifactAttestation.Matches([], digest));
        Assert.False(AllocationModelArtifactAttestation.Matches(data, digest.ToUpperInvariant()));
        Assert.False(AllocationModelArtifactAttestation.Matches(data, "untrusted"));
    }
}
