import { trpc } from '@/app/_trpc/client'
import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'

export type FeedbackType = 'THUMBS_UP' | 'THUMBS_DOWN'

interface UseMessageFeedbackProps {
  messageId: string
  fileId: string
}

export function useMessageFeedback({ messageId, fileId }: UseMessageFeedbackProps) {
  const { toast } = useToast()
  const utils = trpc.useContext()

  // Get existing feedback
  const { data: existingFeedback } = trpc.getMessageFeedback.useQuery(
    { messageId },
    { 
      enabled: !!messageId,
      staleTime: Infinity // Feedback doesn't change often
    }
  )

  const [optimisticFeedback, setOptimisticFeedback] = useState<FeedbackType | null>(null)

  // Submit feedback mutation
  const { mutate: submitFeedback, isLoading } = trpc.submitFeedback.useMutation({
    onMutate: async ({ feedbackType }) => {
      // Cancel any outgoing refetches
      await utils.getMessageFeedback.cancel({ messageId })

      // Snapshot the previous value
      const previousFeedback = utils.getMessageFeedback.getData({ messageId })

      // Optimistically update
      setOptimisticFeedback(
        previousFeedback?.feedbackType === feedbackType ? null : feedbackType
      )

      return { previousFeedback }
    },
    onError: (err, _, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousFeedback) {
        setOptimisticFeedback(context.previousFeedback.feedbackType as FeedbackType)
      } else {
        setOptimisticFeedback(null)
      }
      
      toast({
        title: 'Failed to submit feedback',
        description: 'Please try again',
        variant: 'destructive',
      })
    },
    onSuccess: (data) => {
      // Update the query data with the server response
      utils.getMessageFeedback.setData(
        { messageId },
        data.feedback
      )
      setOptimisticFeedback(null)
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.getMessageFeedback.invalidate({ messageId })
    },
  })

  const handleFeedback = (
    feedbackType: FeedbackType,
    options?: {
      feedbackCategory?: string
      correctedResponse?: string
    }
  ) => {
    if (isLoading) return

    submitFeedback({
      messageId,
      fileId,
      feedbackType,
      feedbackCategory: options?.feedbackCategory,
      correctedResponse: options?.correctedResponse,
    })
  }

  // Determine current feedback state
  const currentFeedback = optimisticFeedback ?? existingFeedback?.feedbackType ?? null

  return {
    currentFeedback,
    handleFeedback,
    isLoading,
  }
}
