import type * as React from 'react'
import { cn } from '../../lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse bg-surface-alt rounded', className)} {...props} />
}

export { Skeleton }
