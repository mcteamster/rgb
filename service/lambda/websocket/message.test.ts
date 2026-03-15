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
import { handleCreateGame, handleJoinGame, handleRejoinGame, handleGetGame, handleKickPlayer } from './game-handlers'
import {
    handleSubmitColor, handleStartRound, handleUpdateDraftColor,
    handleUpdateDraftDescription, handleSubmitDescription,
    handleFinaliseGame, handleResetGame, handleCloseRoom,
} from './round-handlers'

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

    it('routes getGame', async () => {
        await handler(makeEvent({ action: 'getGame', gameId: 'game1', playerId: 'p1' }))
        expect(handleGetGame).toHaveBeenCalled()
    })

    it('routes updateDraftColor', async () => {
        await handler(makeEvent({ action: 'updateDraftColor', gameId: 'game1', playerId: 'p1', data: { color: { h: 180, s: 50, l: 50 } } }))
        expect(handleUpdateDraftColor).toHaveBeenCalled()
    })

    it('routes updateDraftDescription', async () => {
        await handler(makeEvent({ action: 'updateDraftDescription', gameId: 'game1', playerId: 'p1', data: { description: 'sky blue' } }))
        expect(handleUpdateDraftDescription).toHaveBeenCalled()
    })

    it('routes kickPlayer with leave reason when kicking self', async () => {
        await handler(makeEvent({ action: 'kickPlayer', gameId: 'game1', playerId: 'p1', data: { targetPlayerId: 'p1' } }))
        expect(handleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'p1', 'p1', 'leave')
    })

    it('routes kickPlayer with kick reason when kicking another player', async () => {
        await handler(makeEvent({ action: 'kickPlayer', gameId: 'game1', playerId: 'p1', data: { targetPlayerId: 'p2' } }))
        expect(handleKickPlayer).toHaveBeenCalledWith('conn1', 'game1', 'p1', 'p2', 'kick')
    })

    it('routes submitDescription through deadline enforcement', async () => {
        await handler(makeEvent({ action: 'submitDescription', gameId: 'game1', playerId: 'p1', data: { description: 'ocean blue' } }))
        expect(handleSubmitDescription).toHaveBeenCalled()
    })

    it('routes finaliseGame', async () => {
        await handler(makeEvent({ action: 'finaliseGame', gameId: 'game1', playerId: 'p1' }))
        expect(handleFinaliseGame).toHaveBeenCalled()
    })

    it('routes resetGame', async () => {
        await handler(makeEvent({ action: 'resetGame', gameId: 'game1', playerId: 'p1' }))
        expect(handleResetGame).toHaveBeenCalled()
    })

    it('routes closeRoom', async () => {
        await handler(makeEvent({ action: 'closeRoom', gameId: 'game1', playerId: 'p1' }))
        expect(handleCloseRoom).toHaveBeenCalled()
    })

    it('returns 400 for unknown action', async () => {
        const result = await handler(makeEvent({ action: 'unknownAction', gameId: 'g1', playerId: 'p1' }))
        expect(result.statusCode).toBe(400)
    })

    it('returns 500 when a handler throws', async () => {
        vi.mocked(handleStartRound).mockRejectedValueOnce(new Error('boom'))
        const result = await handler(makeEvent({ action: 'startRound', gameId: 'game1', playerId: 'p1' }))
        expect(result.statusCode).toBe(500)
    })
})
