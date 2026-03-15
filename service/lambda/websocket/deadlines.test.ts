import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockBroadcastToGame } = vi.hoisted(() => ({
    mockSend: vi.fn(),
    mockBroadcastToGame: vi.fn(),
}))

vi.mock('./aws-clients', () => ({
    dynamodb: { send: mockSend },
    broadcastToGame: mockBroadcastToGame,
}))

import { checkAndEnforceDeadlines } from './deadlines'

const past = new Date(Date.now() - 60000).toISOString()
const future = new Date(Date.now() + 60000).toISOString()

const makeGame = (overrides: any = {}) => ({
    gameId: 'game1',
    meta: { status: 'playing', currentRound: 0 },
    config: { guessingTimeLimit: 15, descriptionTimeLimit: 30 },
    players: [
        { playerId: 'describer', playerName: 'Alice', joinedAt: '2024-01-01T00:00:00Z', score: 0 },
        { playerId: 'guesser', playerName: 'Bob', joinedAt: '2024-01-01T00:00:01Z', score: 0, draftColor: { h: 120, s: 50, l: 50 } },
    ],
    gameplay: {
        rounds: [{
            targetColor: { h: 120, s: 60, l: 50 },
            describerId: 'describer',
            phase: 'describing',
            submissions: {},
            timers: { descriptionDeadline: past, guessingDeadline: null },
        }],
    },
    ...overrides,
})

beforeEach(() => {
    mockSend.mockReset()
    mockBroadcastToGame.mockReset()
})

describe('checkAndEnforceDeadlines', () => {
    it('returns early when game is not found', async () => {
        mockSend.mockResolvedValueOnce({ Item: undefined })
        await checkAndEnforceDeadlines('game1')
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })

    it('returns early when there is no current round', async () => {
        const game = makeGame({ meta: { status: 'waiting', currentRound: null }, gameplay: { rounds: [] } })
        mockSend.mockResolvedValueOnce({ Item: game })
        await checkAndEnforceDeadlines('game1')
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })

    it('does nothing when description deadline is null', async () => {
        const game = makeGame()
        game.gameplay.rounds[0].timers.descriptionDeadline = null
        mockSend.mockResolvedValueOnce({ Item: game })
        await checkAndEnforceDeadlines('game1')
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })

    it('does nothing when description deadline has not passed yet', async () => {
        const game = makeGame()
        game.gameplay.rounds[0].timers.descriptionDeadline = future
        mockSend.mockResolvedValueOnce({ Item: game })
        await checkAndEnforceDeadlines('game1')
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })

    it('does nothing when guessing deadline has not passed yet', async () => {
        const game = makeGame({
            gameplay: { rounds: [{ ...makeGame().gameplay.rounds[0], phase: 'guessing', timers: { guessingDeadline: future } }] },
        })
        mockSend.mockResolvedValueOnce({ Item: game })
        await checkAndEnforceDeadlines('game1')
        expect(mockSend).toHaveBeenCalledTimes(1)
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })

    it('enforces description deadline — blank draft skips to reveal with special scoring', async () => {
        const game = makeGame() // describer has no draftDescription → blank
        const updatedGame = makeGame()
        mockSend
            .mockResolvedValueOnce({ Item: game })        // checkAndEnforceDeadlines GetCommand
            .mockResolvedValueOnce({ Item: game })        // enforceDescriptionDeadline GetCommand
            .mockResolvedValueOnce({})                    // UpdateCommand
            .mockResolvedValueOnce({ Item: updatedGame }) // GetCommand for broadcast
        await checkAndEnforceDeadlines('game1')
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'gameplayUpdated' }))
    })

    it('enforces description deadline — non-blank draft transitions to guessing', async () => {
        const game = makeGame()
        game.players[0].draftDescription = 'A rich ocean blue'
        const updatedGame = makeGame()
        mockSend
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: updatedGame })
        await checkAndEnforceDeadlines('game1')
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'gameplayUpdated' }))
    })

    it('enforces guessing deadline — auto-submits draft colors and transitions to reveal', async () => {
        const game = makeGame({
            gameplay: {
                rounds: [{
                    targetColor: { h: 120, s: 60, l: 50 },
                    describerId: 'describer',
                    phase: 'guessing',
                    submissions: {},
                    timers: { descriptionDeadline: null, guessingDeadline: past },
                }],
            },
        })
        const updatedGame = makeGame()
        mockSend
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ Item: updatedGame })
        await checkAndEnforceDeadlines('game1')
        expect(mockBroadcastToGame).toHaveBeenCalledWith('game1', expect.objectContaining({ type: 'playersUpdated' }))
    })

    it('skips guessing enforcement when phase changed away from guessing', async () => {
        const game = makeGame({
            gameplay: {
                rounds: [{
                    describerId: 'describer',
                    phase: 'guessing',
                    submissions: {},
                    timers: { guessingDeadline: past },
                }],
            },
        })
        // Second get (enforceGuessingDeadline) returns game now in reveal phase
        const revealGame = makeGame({
            gameplay: { rounds: [{ ...game.gameplay.rounds[0], phase: 'reveal' }] },
        })
        mockSend
            .mockResolvedValueOnce({ Item: game })
            .mockResolvedValueOnce({ Item: revealGame })
        await checkAndEnforceDeadlines('game1')
        expect(mockBroadcastToGame).not.toHaveBeenCalled()
    })
})
