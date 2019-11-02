from bs4 import BeautifulSoup
import csv
import requests 

res = requests.get("https://pokemondb.net/pokedex/stats/gen1")

soup = BeautifulSoup(res.text, 'html.parser')

table = soup.find("div", class_=["grid-col span-md-12 span-lg-10"])
table = soup.find("div", class_=["resp-scroll"])
table = table.find('table', id='pokedex')
table_head = soup.find("thead")
head_categories = table_head.find_all('th')
table_body = table.find('tbody')
rows = table_body.find_all('tr')

categories = []
num_rows = 0
for val in head_categories:
    num_rows += 1
    if num_rows > 2:
        categories.append(val.find("div").text)

data = []
data.append(categories)

for row in rows:
    cols = []
    num_cols = 0
    for col in row.find_all('td'):
        col_class = col['class'][0]
        if col_class == 'cell-name':
            cols.append(col.find('a').text)
        elif col_class == 'cell-icon':
            type_list = []
            for types in col.find_all('a'):
                type_list.append(types.text)
            cols.append(type_list)
        elif col_class == 'cell-total' or col_class == 'cell-num':
            cols.append(col.text)



    data.append(cols)

with open('gen1_pokemon.csv', 'w', newline='') as pokemon:
    wr = csv.writer(pokemon, quoting=csv.QUOTE_ALL)
    for row in data:
        wr.writerow(row)
