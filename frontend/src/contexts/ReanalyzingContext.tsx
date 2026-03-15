import { createContext, useContext, useState, useCallback } from "react"

interface ReanalyzingContextType {
  isReanalyzing: (id: string) => boolean
  startReanalyzing: (id: string) => void
  stopReanalyzing: (id: string) => void
}

const ReanalyzingContext = createContext<ReanalyzingContextType>({
  isReanalyzing: () => false,
  startReanalyzing: () => {},
  stopReanalyzing: () => {},
})

export function ReanalyzingProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set())

  const startReanalyzing = useCallback((id: string) => {
    setIds(prev => new Set(prev).add(id))
  }, [])

  const stopReanalyzing = useCallback((id: string) => {
    setIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const isReanalyzing = useCallback((id: string) => ids.has(id), [ids])

  return (
    <ReanalyzingContext.Provider value={{ isReanalyzing, startReanalyzing, stopReanalyzing }}>
      {children}
    </ReanalyzingContext.Provider>
  )
}

export function useReanalyzing() {
  return useContext(ReanalyzingContext)
}
