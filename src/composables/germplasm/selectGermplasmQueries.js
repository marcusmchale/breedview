import { useGermplasmQuery} from "@/composables/germplasm/germplasmQuery";
import { useCropsQuery } from "@/composables/germplasm/cropsQuery";
import { useGermplasmLazyQuery } from "@/composables/germplasm/germplasmLazyQuery";

export function useSelectGermplasmQueries({germplasmId}) {

    const {
        germplasm,
        germplasmLoading,
        germplasmError
    }  = useGermplasmQuery(germplasmId)


    const {
        crops,
        cropsLoading,
        cropsError,
        refetchCrops
    } = useCropsQuery()

    const {
        germplasm: currentChildGermplasm,
        germplasmLoading: childGermplasmLoading,
        loadChildGermplasm
    } = useGermplasmLazyQuery()

    const hasChildren = (node) => {
      return node.sinks && node.sinks.length > 0
    }

    return {
        germplasm,
        germplasmLoading,
        germplasmError,

        crops,
        cropsLoading,
        cropsError,
        refetchCrops,

        currentChildGermplasm,
        childGermplasmLoading,
        loadChildGermplasm,

        hasChildren
    }
}