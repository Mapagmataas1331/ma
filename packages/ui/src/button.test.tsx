import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './components/primitives'

describe('Button', () => {
  it('renders its label', () => {
    render(<Button>Continue</Button>)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy()
  })
})
