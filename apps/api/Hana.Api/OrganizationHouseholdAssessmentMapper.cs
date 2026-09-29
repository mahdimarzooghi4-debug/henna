using Hana.Domain.Credit;
using Hana.Infrastructure.Organization;

namespace Hana.Api;

internal static class OrganizationHouseholdAssessmentMapper
{
    internal static HouseholdNeedAssessmentInput Map(
        OrganizationHouseholdReferralRecord referral,
        IReadOnlyCollection<OrganizationHouseholdMemberRecord> members)
    {
        ArgumentNullException.ThrowIfNull(referral);
        ArgumentNullException.ThrowIfNull(members);
        if (members.Count is < 1 or > 20)
            throw new InvalidOperationException("Household member count is incomplete.");

        var underTwo = 0;
        var ageTwoToFive = 0;
        var ageSixToSeventeen = 0;
        var ageEighteenToFiftyNine = 0;
        var ageSixtyOrOlder = 0;
        var seniorsNeedingSupport = 0;
        foreach (var member in members)
        {
            switch (member.LifeStage)
            {
                case OrganizationHouseholdCategories.Infant: underTwo++; break;
                case OrganizationHouseholdCategories.Preschool: ageTwoToFive++; break;
                case OrganizationHouseholdCategories.SchoolAge: ageSixToSeventeen++; break;
                case OrganizationHouseholdCategories.Adult: ageEighteenToFiftyNine++; break;
                case OrganizationHouseholdCategories.OlderAdult:
                    ageSixtyOrOlder++;
                    if (member.NeedsPracticalSupport is null)
                        throw new InvalidOperationException("Practical support status for every senior is required.");
                    if (member.NeedsPracticalSupport.Value) seniorsNeedingSupport++;
                    break;
                default: throw new InvalidOperationException("Unknown household life-stage category.");
            }
        }

        return new HouseholdNeedAssessmentInput
        {
            HealthBurden = referral.HealthBurdenLevel switch
            {
                OrganizationAllocationAssessmentTypes.HealthNone => HealthBurdenLevel.NoOngoingTreatment,
                OrganizationAllocationAssessmentTypes.HealthOneManageable => HealthBurdenLevel.OneManageableOngoingCase,
                OrganizationAllocationAssessmentTypes.HealthHighBurden => HealthBurdenLevel.HighCostOrLimitingOrMultipleManageableCases,
                OrganizationAllocationAssessmentTypes.HealthSevere => HealthBurdenLevel.SevereOngoingCareOrMultipleHighBurdenCases,
                _ => throw new InvalidOperationException("Household health assessment is missing or unknown.")
            },
            EconomicHardship = referral.EconomicHardshipLevel switch
            {
                OrganizationAllocationAssessmentTypes.HardshipNeedsMet => EconomicHardshipLevel.EssentialNeedsGenerallyMet,
                OrganizationAllocationAssessmentTypes.HardshipOccasionalShortfall => EconomicHardshipLevel.OccasionalShortfallInOneEssentialNeed,
                OrganizationAllocationAssessmentTypes.HardshipRecurrentShortfall => EconomicHardshipLevel.RecurrentShortfallOrEssentialDebt,
                OrganizationAllocationAssessmentTypes.HardshipMultipleUnmet => EconomicHardshipLevel.MultipleEssentialNeedsUnmetOrSevereInstability,
                _ => throw new InvalidOperationException("Household economic assessment is missing or unknown.")
            },
            CareAndSupport = referral.CareSupportLevel switch
            {
                OrganizationAllocationAssessmentTypes.CareSupportAvailable => CareSupportLevel.EffectiveAdultOrPracticalSupportAvailable,
                OrganizationAllocationAssessmentTypes.OneAdultNoDependents => CareSupportLevel.OneResponsibleAdultWithoutDependents,
                OrganizationAllocationAssessmentTypes.LoneCaregiverOneDependent => CareSupportLevel.LoneCaregiverWithOneDependentOrLimitedSupport,
                OrganizationAllocationAssessmentTypes.NoPracticalSupport => CareSupportLevel.NoPracticalSupportWithMultipleDependentsOrHighCareBurden,
                _ => throw new InvalidOperationException("Household care assessment is missing or unknown.")
            },
            Education = referral.EducationAttainment switch
            {
                OrganizationAllocationAssessmentTypes.EducationBachelorOrHigher => EducationAttainment.BachelorOrHigher,
                OrganizationAllocationAssessmentTypes.EducationDiplomaOrAssociate => EducationAttainment.DiplomaOrAssociate,
                OrganizationAllocationAssessmentTypes.EducationBelowDiploma => EducationAttainment.BelowDiplomaWithFormalEducation,
                OrganizationAllocationAssessmentTypes.EducationNoFormalOrLiteracy => EducationAttainment.NoLiteracyOrFormalEducation,
                _ => throw new InvalidOperationException("Reference-person education assessment is missing or unknown.")
            },
            HousingTenure = referral.HousingTenure switch
            {
                OrganizationHousingTenureTypes.Owner => HousingTenureType.Owner,
                OrganizationHousingTenureTypes.Tenant => HousingTenureType.Tenant,
                _ => throw new InvalidOperationException("Household housing tenure is missing or unknown.")
            },
            HouseholdSize = members.Count,
            AgeComposition = new HouseholdAgeComposition(
                underTwo, ageTwoToFive, ageSixToSeventeen,
                ageEighteenToFiftyNine, ageSixtyOrOlder, seniorsNeedingSupport)
        };
    }
}
