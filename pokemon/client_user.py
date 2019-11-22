import .client
import asyncio

res = asyncio.get_event_loop().run_until_complete(client.send_action('1'))
print(res)