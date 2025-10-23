'use client'

import { trpc } from '@/app/_trpc/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Skeleton } from './ui/skeleton'

interface FeedbackStatsProps {
  fileId: string
}

export function FeedbackStats({ fileId }: FeedbackStatsProps) {
  const { data: stats, isLoading } = trpc.getFeedbackStats.useQuery(
    { fileId },
    { 
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 10000 
    }
  )

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!stats) return null

  const satisfactionRate = stats.total > 0 
    ? Math.round((stats.thumbsUp / stats.total) * 100)
    : 0

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Feedback Summary</CardTitle>
        <CardDescription className="text-xs">
          Student responses to AI explanations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Helpful</span>
          </div>
          <span className="text-sm font-semibold">{stats.thumbsUp}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThumbsDown className="h-4 w-4 text-red-600" />
            <span className="text-sm text-muted-foreground">Not Helpful</span>
          </div>
          <span className="text-sm font-semibold">{stats.thumbsDown}</span>
        </div>
        
        {stats.total > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Satisfaction Rate</span>
              <span className={`text-sm font-bold ${
                satisfactionRate >= 80 ? 'text-green-600' : 
                satisfactionRate >= 60 ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {satisfactionRate}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
