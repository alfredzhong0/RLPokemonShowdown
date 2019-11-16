import asyncio
import websockets


uri = "ws://localhost:8080"
async def hello():
    async with websockets.connect(uri) as websocket:
        name = input("What's your name? ")

        await websocket.send(name)
        print(f"> {name}")

        greeting = await websocket.recv()
        print(f"< {greeting}")

async def send_action_wrapper(action):
    async with websockets.connect(uri) as websocket:
        await websocket.send(action)
        print('Action:', action)
        res = await websocket.recv()
    return res

async def reset_wrapper():
    async with websockets.connect(uri) as websocket:
        await websocket.send('reset')
        print('Resetting state')
        res = await websocket.recv()
        print(res)
    return res

def send_action(action):
    action = str(action)
    return asyncio.get_event_loop().run_until_complete(send_action_wrapper(action))

def reset_server():
    return asyncio.get_event_loop().run_until_complete(reset_wrapper())

#asyncio.get_event_loop().run_until_complete(hello())

#asyncio.run(hello())
