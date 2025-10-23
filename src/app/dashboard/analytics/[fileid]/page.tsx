import { redirect } from 'next/navigation'
import { db } from '@/db'
import { FeedbackStats } from '@/components/FeedbackStats'
import { CorrectionsSection } from '@/components/CorrectionsSection'
import Link from 'next/link'
import { ArrowLeft, FileText, ThumbsUp, ThumbsDown, TrendingUp, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { format } from 'date-fns'

interface PageProps {
  params: {
    fileid: string
  }
}

const AnalyticsPage = async ({ params }: PageProps) => {
  const { fileid } = params

  const file = await db.file.findFirst({
    where: {
      id: fileid,
    },
  })

  if (!file) redirect('/dashboard')

  // Fetch detailed feedback data
  const feedbackData = await db.messageFeedback.findMany({
    where: {
      fileId: fileid,
    },
    include: {
      message: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  }) as Array<{
    id: string
    feedbackType: 'THUMBS_UP' | 'THUMBS_DOWN'
    feedbackCategory?: 'TOO_COMPLEX' | 'INCORRECT_INFO' | 'MISSING_CONTEXT' | 'OFF_TOPIC' | 'OTHER' | null
    correctedResponse?: string | null
    createdAt: Date
    message: {
      text: string
    }
  }>

  // Calculate detailed stats
  const totalFeedback = feedbackData.length
  const thumbsUp = feedbackData.filter(f => f.feedbackType === 'THUMBS_UP').length
  const thumbsDown = feedbackData.filter(f => f.feedbackType === 'THUMBS_DOWN').length
  const satisfactionRate = totalFeedback > 0 ? Math.round((thumbsUp / totalFeedback) * 100) : 0

  // Get recent feedback
  const recentFeedback = feedbackData.slice(0, 10)
  
  // Get recent corrections
  const recentCorrections = feedbackData
    .filter(f => f.feedbackType === 'THUMBS_DOWN' && f.correctedResponse)
    .slice(0, 5)

  // Get feedback by date (last 7 days)
  const last7Days = new Date()
  last7Days.setDate(last7Days.getDate() - 7)
  
  const feedbackByDate = feedbackData
    .filter((f: any) => new Date(f.createdAt) > last7Days)
    .reduce((acc: Record<string, { thumbsUp: number; thumbsDown: number }>, feedback: any) => {
      const date = format(new Date(feedback.createdAt), 'MMM dd')
      if (!acc[date]) {
        acc[date] = { thumbsUp: 0, thumbsDown: 0 }
      }
      if (feedback.feedbackType === 'THUMBS_UP') {
        acc[date].thumbsUp++
      } else {
        acc[date].thumbsDown++
      }
      return acc
    }, {} as Record<string, { thumbsUp: number; thumbsDown: number }>)

  return (
    <div className='mx-auto max-w-7xl p-6 md:p-10'>
      <div className='flex items-center gap-4 mb-8'>
        <Link
          href={`/dashboard/${fileid}`}
          className='flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='h-4 w-4' />
          Back to chat
        </Link>
      </div>

      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>Analytics Dashboard</h1>
        <p className='text-muted-foreground mt-2 flex items-center gap-2'>
          <FileText className='h-4 w-4' />
          {file.name}
        </p>
      </div>

      {/* Summary Cards */}
      <div className='grid gap-6 md:grid-cols-4 mb-8'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              Total Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>{totalFeedback}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
              <ThumbsUp className='h-4 w-4 text-green-600' />
              Helpful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-green-600'>{thumbsUp}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
              <ThumbsDown className='h-4 w-4 text-red-600' />
              Not Helpful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold text-red-600'>{thumbsDown}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
              <TrendingUp className='h-4 w-4' />
              Satisfaction Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${
              satisfactionRate >= 80 ? 'text-green-600' : 
              satisfactionRate >= 60 ? 'text-yellow-600' : 
              'text-red-600'
            }`}>
              {satisfactionRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* Client-side component for real-time updates */}
        <div className='md:col-span-1'>
          <FeedbackStats fileId={fileid} />
        </div>

        {/* Feedback by Date */}
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium'>Feedback Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {Object.entries(feedbackByDate).length > 0 ? (
                Object.entries(feedbackByDate).map(([date, stats]) => (
                  <div key={date} className='flex items-center justify-between text-sm'>
                    <span className='text-muted-foreground'>{date}</span>
                    <div className='flex items-center gap-4'>
                      <span className='flex items-center gap-1'>
                        <ThumbsUp className='h-3 w-3 text-green-600' />
                        {stats.thumbsUp}
                      </span>
                      <span className='flex items-center gap-1'>
                        <ThumbsDown className='h-3 w-3 text-red-600' />
                        {stats.thumbsDown}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-sm text-muted-foreground'>No feedback in the last 7 days</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Feedback */}
      <Card className='mt-6'>
        <CardHeader>
          <CardTitle className='text-sm font-medium flex items-center gap-2'>
            <Clock className='h-4 w-4' />
            Recent Feedback
          </CardTitle>
          <CardDescription>Last 10 feedback responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {recentFeedback.length > 0 ? (
              recentFeedback.map((feedback) => (
                <div
                  key={feedback.id}
                  className='flex items-start justify-between border-b pb-3 last:border-0'
                >
                  <div className='flex-1 space-y-1'>
                    <p className='text-sm text-muted-foreground line-clamp-2'>
                      {feedback.message.text}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {format(new Date(feedback.createdAt), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className='ml-4'>
                    {feedback.feedbackType === 'THUMBS_UP' ? (
                      <ThumbsUp className='h-4 w-4 text-green-600' />
                    ) : (
                      <ThumbsDown className='h-4 w-4 text-red-600' />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className='text-sm text-muted-foreground'>No feedback yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Corrections */}
      {recentCorrections.length > 0 && (
        <div className='mt-6'>
          <CorrectionsSection corrections={recentCorrections} />
        </div>
      )}
    </div>
  )
}

export default AnalyticsPage
