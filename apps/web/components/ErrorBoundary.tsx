'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(error, info)
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="min-h-screen bg-surface flex items-center justify-center">
            <div className="text-center p-8 max-w-md">
              <h2 className="text-xl font-semibold text-ink mb-2">Something went wrong</h2>
              <p className="text-muted-foreground text-sm mb-4">
                The error has been reported. Please refresh the page.
              </p>
              <button
                type="button"
                className="px-4 py-2 bg-primary text-white rounded-md text-sm"
                onClick={() => this.setState({ hasError: false })}
              >
                Try again
              </button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
