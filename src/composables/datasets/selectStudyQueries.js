import { computed, watch} from 'vue'
import { useStudyQuery } from "@/composables/programs/studyQuery";
import { useProgramsQuery } from "@/composables/programs/programsQuery";
import { useProgramQuery } from "@/composables/programs/programQuery";
import { useTrialQuery } from "@/composables/programs/trialQuery";

export function useSelectStudyQueries({programId, trialId, studyId}) {

    // For current selected study
    const {
        study,
        studyLoading,
        studyError
    } = useStudyQuery(studyId)

    // For programs breadcrumb top level
    const {
        programs,
        programsLoading,
        programsError
    } = useProgramsQuery()

    // To get trials from program for breadcrumb trial level
    const {
        program,
        programLoading: trialsLoading,
        programError: trialsError
    } = useProgramQuery(programId)

    const trials = computed(() => {
        return program.value?.trials ?? []
    })

    //To get studies from trial breadcrumb study level
    const {
        trial,
        trialLoading: studiesLoading,
        trialError: studiesError
    } = useTrialQuery(trialId)

    const studies = computed(() => {
        return trial.value?.studies ?? []
    })

    return {
        study,
        studyLoading,
        studyError,

        programs,
        programsLoading,
        programsError,

        trials,
        trialsLoading,
        trialsError,

        studies,
        studiesLoading,
        studiesError,
    }
}