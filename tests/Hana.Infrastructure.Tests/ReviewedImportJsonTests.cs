using System.Text.Json;
using Hana.Infrastructure.ImportReview;

namespace Hana.Infrastructure.Tests;

public sealed class ReviewedImportJsonTests
{
    [Theory]
    [InlineData("{\"state\":\"PUBLISHED\",\"state\":\"DRAFT\"}")]
    [InlineData("{\"state\":\"PUBLISHED\",\"st\\u0061te\":\"DRAFT\"}")]
    [InlineData("{\"categories\":[],\"categories\":[]}")]
    [InlineData("{\"categories\":[{\"state\":\"PUBLISHED\",\"state\":\"DRAFT\"}]}")]
    [InlineData("{\"cities\":[{\"nested\":{\"id\":1,\"id\":2}}]}")]
    [InlineData("{\"products\":[{\"name\":\"A\",\"name\":\"B\"}]}")]
    public void ExactOrEscapedDuplicateObjectKeysAreRejected(string json) =>
        Assert.Throws<JsonException>(() =>
            ReviewedImportJson.RejectDuplicateProperties(json));

    [Theory]
    [InlineData("{\"state\":1,\"State\":2}")]
    [InlineData("{\"categories\":[{\"state\":\"DRAFT\"},{\"state\":\"PUBLISHED\"}]}")]
    [InlineData("{\"products\":[],\"categories\":[]}")]
    public void DistinctOrRepeatedKeysInSeparateObjectsAreNotDuplicates(string json) =>
        ReviewedImportJson.RejectDuplicateProperties(json);

    [Theory]
    [InlineData("{\"state\":1,}")]
    [InlineData("{/*comment*/\"state\":1}")]
    [InlineData("{\"state\":1} {}")]
    [InlineData("{\"state\":")]
    public void MalformedOrRelaxedJsonIsNotAccepted(string json) =>
        Assert.Throws<JsonException>(() =>
            ReviewedImportJson.RejectDuplicateProperties(json));

    [Fact]
    public void DeeplyNestedInputIsRejectedWithinImportDepthBound()
    {
        var json = new string('[', 13) + "0" + new string(']', 13);
        Assert.Throws<JsonException>(() =>
            ReviewedImportJson.RejectDuplicateProperties(json));
    }
}
