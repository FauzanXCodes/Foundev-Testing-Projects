#!/usr/bin/env python
# coding: utf-8


import pandas as pd
import numpy as np

file_path = 'best_songs_spotify_2000_2023.csv'

df = pd.read_csv(file_path, sep=';') 

# <b>popularity - Measures how popular a song is on Spotify from 0-100</b>

df = df.drop(df.iloc[:, 4:13],axis = 1) #drop columns 4-14


pd.set_option('display.max_rows', 20)

unique_values = df['top genre'].unique() # Give amount of unique genres
len(unique_values)


value_counts = df['top genre'].value_counts() # Give the genre name and number of the genres  
print(value_counts)
#(boy band, neo mellow, big room, reggaeton,  permanent wave, alt z, g funk)
# (grime, crunk, metropopolis, brostep, adult standards, adult standards, afroswing, dancefloor dnb)
# (afrofuturism, aussietronica, talent show, downtempo, hel, big beat, uk garage, complextro, reggae fusion)
# (electro, gen z singer-songwriter, afrobeats, ectofolk, stomp and holler, beatlesque, idol, electronic)
# (lilith, trap, filmi, bhangra, ccm, gospel, bounce, chicago bop, 2-step, anti-folk, mellow gold, anarcho-punk)
# (neo-singer-songwriter, trance, dubstep, classic schlager, sertanejo, future garage, contemporary vocal jazz)
# (french shoegaze, scottish singer-songwriter, sad lo-fi, irish singer-songwriter, dark clubbing)
# (mambo chileno, australian psych, new french touch, indonesian jazz, slowed and reverb, soca)
# (dutch trance, celtic, techno)

df


# Give song in desired genre
desired_genres = ['pop', 'k-pop girl group'] 
filtered_df = df[df['top genre'].isin(desired_genres)]
songs_info = filtered_df[['title', 'artist', 'year']].values.tolist()


songs_info


# Store similar genres into a more general genreun
pop_songs = set()
rock_songs = set()
hip_hop_songs = set()
metal_songs = set()
edm_songs = set()
rb_songs = set()
rap_songs = set()
#country_songs = 
#soul_songs = 
#dance_songs = 
#indie_songs = 
#house_songs = 
#emo_songs = 
#drill_songs = 

for index, row in df.iterrows():
    if "pop" in row['top genre'].lower():  # Check if "pop" (case insensitive) is in the genre
        pop_songs.add(row['top genre'])
    elif "rock" in row['top genre'].lower():
        rock_songs.add(row['top genre'])
    elif "hip hop" in row['top genre'].lower():
        hip_hop_songs.add(row['top genre'])
    elif "metal" in row['top genre'].lower():
        metal_songs.add(row['top genre'])
    elif "edm" in row['top genre'].lower():
        edm_songs.add(row['top genre'])
    elif "r&b" in row['top genre'].lower():
        rb_songs.add(row['top genre'])
    elif "rap" in row['top genre'].lower():
        rap_songs.add(row['top genre'])

print(hip_hop_songs)


desired_genres = rock_songs 
filtered_df = df[df['top genre'].isin(desired_genres)]
songs_info = filtered_df[['title', 'artist', 'year']].values.tolist()


songs_info





