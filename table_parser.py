from bs4 import BeautifulSoup
import csv
import requests 

res = requests.get("https://pokemondb.net/move/generation/1")

soup = BeautifulSoup(res.text, 'html.parser')

table = soup.find("table", id="moves")
table_head = soup.find("thead")
head_categories = table_head.find_all('th')
table_body = table.find('tbody')
rows = table_body.find_all('tr')

categories = []
for val in head_categories:
    categories.append(val.find("div").text)

data = []
data.append(categories)

for row in rows:
    cols = []
    for col in row.find_all('td'):
        t = col.text.strip()
        if not t:
            for img in row.find_all('img'):
                t = img.attrs['src']

        cols.append(t)
    data.append(cols)

with open('gen1_moves.csv', 'w', newline='') as moves:
    wr = csv.writer(moves, quoting=csv.QUOTE_ALL)
    for row in data:
        wr.writerow(row)
