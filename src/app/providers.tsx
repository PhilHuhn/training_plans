'use client'
import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import TourProvider from '@/components/tour/tour-provider'

export default function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        {/* Above the app shell rather than inside it: /welcome sits outside the
            (app) route group but still starts the tour. */}
        <TourProvider>{children}</TourProvider>
      </TooltipProvider>
      <Toaster />
    </QueryClientProvider>
  )
}
