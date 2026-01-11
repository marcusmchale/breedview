import { useLayoutQuery } from "@/composables/arrangements/layoutQuery";
import { useLayoutsLazyQuery} from "@/composables/arrangements/layoutsLazyQuery";


export function useLayoutNodeQueries({layoutId}) {

    const {
        layout,
        layoutLoading,
        layoutError,
        refetchLayout
    } = useLayoutQuery(layoutId)

    const {
        loadChildLayouts,
        layoutsLoading: childLayoutsLoading,
        layoutsError: childLayoutsError
    } = useLayoutsLazyQuery()


    return {
        layout,
        layoutLoading,
        layoutError,
        refetchLayout,

        loadChildLayouts,
        childLayoutsLoading,
        childLayoutsError

    }
}