import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockValidatePlayerAction } = vi.hoisted(() => ({
    mockValidatePlayerAction: vi.fn(),
}))

vi.mock('./validation', () => ({ validatePlayerAction: mockValidatePlayerAction }))
vi.mock('./deadlines', () => ({ checkAndEnforceDeadlines: vi.fn() }))
vi.mock('./game-handlers', () => ({
    handleCreateGame: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleGetGame: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleJoinGame: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleRejoinGame: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleKickPlayer: vi.fn().mockResolvedValue({ statusCode: 200 }),
}))
vi.mock('./round-handlers', () => ({
    handleUpdateDraftDescription: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleSubmitDescription: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleUpdateDraftColor: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleSubmitColor: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleStartRound: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleFinaliseGame: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleResetGame: vi.fn().mockResolvedValue({ statusCode: 200 }),
    handleCloseRoom: vi.fn().mockResolvedValue({ statusCode: 200 }),
}))

import { handler } from './message'
import { handleCreateGame, handleJoinGame, handleRejoinGame } from './game-handlers'
import { handleSubmitColor, handleStartRound } from './round-handlers'

const makeEvent = (body: object) => ({
    requestContext: { connectionId: 'conn1' },
    body: JSON.stringify(body),
}) as any

beforeEach(() => {
    vi.clearAllMocks()
    mockValidatePlayerAction.mockResolvedValue({ statusCode: 200 })
})

describe('message handler routing', () => {
    it('routes createGame without validation', async () => {
        const result = await handler(makeEvent({ action: 'createGame', playerName: 'Alice' }))
        expect(handleCreateGame).toHaveBeenCalled()
        expect(mockValidatePlayerAction).not.toHaveBeenCalled()
        expect(result.statusCode).toBe(200)
    })

    it('routes joinGame without validation', async () => {
        await handler(makeEvent({ action: 'joinGame', gameId: 'game1', playerName: 'Bob' }))
        expect(handleJoinGame).toHaveBeenCalled()
        expect(mockValidatePlayerAction).not.toHaveBeenCalled()
    })

    it('routes rejoinGame without validation', async () => {
        await handler(makeEvent({ action: 'rejoinGame', gameId: 'game1', playerId: 'p1' }))
        expect(handleRejoinGame).toHaveBeenCalled()
        expect(mockValidatePlayerAction).not.toHaveBeenCalled()
    })

    it('validates player for protected actions', async () => {
        await handler(makeEvent({ action: 'startRound', gameId: 'game1', playerId: 'p1' }))
        expect(mockValidatePlayerAction).toHaveBeenCalled()
        expect(handleStartRound).toHaveBeenCalled()
    })

    it('returns validation error status for invalid player', async () => {
        mockValidatePlayerAction.mockResolvedValue({ statusCode: 403 })
        const result = await handler(makeEvent({ action: 'startRound', gameId: 'game1', playerId: 'p1' }))
        expect(result.statusCode).toBe(403)
        expect(handleStartRound).not.toHaveBeenCalled()
    })

    it('routes submitColor through deadline enforcement', async () => {
        await handler(makeEvent({
            action: 'submitColor',
            gameId: 'game1',
            playerId: 'p1',
            data: { color: { h: 180, s: 50, l: 50 } }
        }))
        expect(handleSubmitColor).toHaveBeenCalled()
    })

    it('returns 400 for unknown action', async () => {
        const result = await handler(makeEvent({ action: 'unknownAction', gameId: 'g1', playerId: 'p1' }))
        expect(result.statusCode).toBe(400)
    })
})
