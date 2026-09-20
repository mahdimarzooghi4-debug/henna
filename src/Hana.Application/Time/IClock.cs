namespace Hana.Application.Time;

public interface IClock
{
    DateTimeOffset UtcNow { get; }
}
