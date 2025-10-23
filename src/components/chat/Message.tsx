import { cn } from '@/lib/utils'
import { ExtendedMessage } from '@/types/message'
import { Icons } from '../Icons'
import ReactMarkdown from 'react-markdown'
import { format } from 'date-fns'
import { forwardRef, useState } from 'react'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'
import { useMessageFeedback } from '@/hooks/useMessageFeedback'
import { Button } from '../ui/button'
import { Volume2, VolumeX, ZoomIn, ThumbsUp, ThumbsDown } from 'lucide-react'
import Image from 'next/image'
import { FeedbackModal } from '../FeedbackModal'

interface MessageProps {
  message: ExtendedMessage
  isNextMessageSamePerson: boolean
}

const Message = forwardRef<HTMLDivElement, MessageProps>(
  ({ message, isNextMessageSamePerson }, ref) => {
    const { speak, stop, isSpeaking, isSupported } = useTextToSpeech()
    const [showFeedbackModal, setShowFeedbackModal] = useState(false)
    
    // Initialize feedback hook for AI messages
    const canProvideFeedback = !message.isUserMessage && message.fileId && message.id !== 'loading-message'
    const { currentFeedback, handleFeedback, isLoading: isFeedbackLoading } = useMessageFeedback({
      messageId: message.id,
      fileId: message.fileId || '',
    })

    const handleSpeak = () => {
      if (isSpeaking) {
        stop()
      } else if (typeof message.text === 'string') {
        speak(message.text)
      }
    }

    const handleThumbsUp = () => {
      handleFeedback('THUMBS_UP')
    }

    const handleThumbsDown = () => {
      if (currentFeedback === 'THUMBS_DOWN') {
        // If already thumbs down, toggle off
        handleFeedback('THUMBS_DOWN')
      } else {
        // Show modal to get correction
        setShowFeedbackModal(true)
      }
    }

    const handleFeedbackSubmit = (data: { feedbackCategory: string; correctedResponse: string }) => {
      handleFeedback('THUMBS_DOWN', data)
      setShowFeedbackModal(false)
    }

    return (
      <>
      <div
        ref={ref}
        className={cn('flex items-end', {
          'justify-end': message.isUserMessage,
        })}>
        <div
          className={cn(
            'relative flex h-6 w-6 aspect-square items-center justify-center',
            {
              'order-2 bg-blue-600 rounded-sm':
                message.isUserMessage,
              'order-1 bg-zinc-800 rounded-sm':
                !message.isUserMessage,
              invisible: isNextMessageSamePerson,
            }
          )}>
          {message.isUserMessage ? (
            <Icons.user className='fill-zinc-200 text-zinc-200 h-3/4 w-3/4' />
          ) : (
            <Icons.logo className='fill-zinc-300 h-3/4 w-3/4' />
          )}
        </div>

        <div
          className={cn(
            'flex flex-col space-y-2 text-base max-w-md mx-2',
            {
              'order-1 items-end': message.isUserMessage,
              'order-2 items-start': !message.isUserMessage,
            }
          )}>
          <div
            className={cn(
              'px-4 py-2 rounded-lg inline-block',
              {
                'bg-blue-600 text-white':
                  message.isUserMessage,
                'bg-gray-200 text-gray-900':
                  !message.isUserMessage,
                'rounded-br-none':
                  !isNextMessageSamePerson &&
                  message.isUserMessage,
                'rounded-bl-none':
                  !isNextMessageSamePerson &&
                  !message.isUserMessage,
              }
            )}>
            {typeof message.text === 'string' ? (
              <ReactMarkdown
                className={cn('prose', {
                  'text-zinc-50': message.isUserMessage,
                })}>
                {message.text}
              </ReactMarkdown>
            ) : (
              message.text
            )}
            
            {/* Display images if available */}
            {message.images && message.images.length > 0 && (
              <div className="mt-3 space-y-2">
                {message.images.map((image) => (
                  <div key={image.id} className="relative">
                    <figure className="relative group">
                      <div className="relative overflow-hidden rounded-md bg-gray-100">
                        <Image
                          src={image.imageUrl}
                          alt={image.caption || `Image from page ${image.pageNumber}`}
                          width={400}
                          height={300}
                          className="object-contain w-full h-auto"
                          loading="lazy"
                        />
                        <button
                          onClick={() => window.open(image.imageUrl, '_blank')}
                          className="absolute top-2 right-2 p-2 bg-black/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                          title="View full size"
                        >
                          <ZoomIn className="h-4 w-4 text-white" />
                        </button>
                      </div>
                      {image.caption && (
                        <figcaption className="mt-1 text-xs text-gray-600 italic">
                          {image.caption}
                        </figcaption>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Page {image.pageNumber} • {image.imageType || 'Image'}
                      </div>
                    </figure>
                  </div>
                ))}
              </div>
            )}
            
            {message.id !== 'loading-message' ? (
              <div
                className={cn(
                  'text-xs select-none mt-2 w-full flex items-center',
                  {
                    'justify-end': message.isUserMessage,
                    'justify-between': !message.isUserMessage,
                  }
                )}>
                {!message.isUserMessage && (
                  <div className="flex items-center gap-1">
                    {isSupported && (
                      <Button
                        onClick={handleSpeak}
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-zinc-500 hover:text-zinc-700"
                      >
                        {isSpeaking ? (
                          <VolumeX className="h-3 w-3" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    
                    {/* Feedback buttons */}
                    {canProvideFeedback && (
                      <>
                        <Button
                          onClick={handleThumbsUp}
                          variant="ghost"
                          size="sm"
                          disabled={isFeedbackLoading}
                          className={cn(
                            "h-6 px-2",
                            currentFeedback === 'THUMBS_UP'
                              ? "text-green-600 hover:text-green-700"
                              : "text-zinc-500 hover:text-green-600"
                          )}
                          title="This was helpful"
                        >
                          <ThumbsUp className={cn(
                            "h-3 w-3",
                            currentFeedback === 'THUMBS_UP' && "fill-current"
                          )} />
                        </Button>
                        
                        <Button
                          onClick={handleThumbsDown}
                          variant="ghost"
                          size="sm"
                          disabled={isFeedbackLoading}
                          className={cn(
                            "h-6 px-2",
                            currentFeedback === 'THUMBS_DOWN'
                              ? "text-red-600 hover:text-red-700"
                              : "text-zinc-500 hover:text-red-600"
                          )}
                          title="This wasn't helpful"
                        >
                          <ThumbsDown className={cn(
                            "h-3 w-3",
                            currentFeedback === 'THUMBS_DOWN' && "fill-current"
                          )} />
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <span
                  className={cn({
                    'text-zinc-500': !message.isUserMessage,
                    'text-blue-300': message.isUserMessage,
                  })}
                >
                  {format(
                    new Date(message.createdAt),
                    'HH:mm'
                  )}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Feedback Modal */}
      {canProvideFeedback && typeof message.text === 'string' && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          originalMessage={message.text}
          onSubmit={handleFeedbackSubmit}
        />
      )}
      </>
    )
  }
)

Message.displayName = 'Message'

export default Message
