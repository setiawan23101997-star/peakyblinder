import React, { useState, useEffect } from 'react'

const eventTypes = [
  'Inter-Server Battle',
  'Clan Annihilation',
  'World Boss',
  "Sindri's Treasure Island",
  'Clan Sanctuary',
]

const WEEKLY_EVENT_SESSIONS = [
  {
    id: 'server-battle-tue-1900',
    event: 'Inter-Server Battle',
    day: 2,
    dayLabel: 'Tuesday',
    time: '20:00',
    endTime: '21:00',
    label: 'Tuesday · 20:00–21:00',
    displayName: 'Server Battle',
  },
  {
    id: 'clan-annihilation-thu-1300',
    event: 'Clan Annihilation',
    day: 4,
    dayLabel: 'Thursday',
    time: '13:00',
    endTime: '14:00',
    label: 'Thursday · 13:00–14:00',
    displayName: 'Clan Annihilation · First Run',
  },
  {
    id: 'clan-annihilation-thu-2000',
    event: 'Clan Annihilation',
    day: 4,
    dayLabel: 'Thursday',
    time: '20:00',
    endTime: '21:00',
    label: 'Thursday · 20:00–21:00',
    displayName: 'Clan Annihilation · Second Run',
  },
  {
    id: 'world-boss-thu-1900',
    event: 'World Boss',
    day: 4,
    dayLabel: 'Thursday',
    time: '19:00',
    label: 'Thursday · 19:00',
    displayName: 'World Boss · Myrkrheim · Wrath of the Earth Bergbernd',
  },
  {
    id: 'sindri-sat-1300',
    event: "Sindri's Treasure Island",
    day: 6,
    dayLabel: 'Saturday',
    time: '13:00',
    endTime: '14:00',
    label: 'Saturday · 13:00–14:00',
    displayName: "Sindri's Treasure Island · First Run",
  },
  {
    id: 'sindri-sat-2000',
    event: "Sindri's Treasure Island",
    day: 6,
    dayLabel: 'Saturday',
    time: '20:00',
    endTime: '21:00',
    label: 'Saturday · 20:00–21:00',
    displayName: "Sindri's Treasure Island · Second Run",
  },
  {
    id: 'world-boss-sat-1900',
    event: 'World Boss',
    day: 6,
    dayLabel: 'Saturday',
    time: '19:00',
    label: 'Saturday · 19:00',
    displayName: 'World Boss · Glasir Forest · Divine Beast of Void Ulnos',
  },
  {
    id: 'clan-sanctuary-sat-2100',
    event: 'Clan Sanctuary',
    day: 6,
    dayLabel: 'Saturday',
    time: '21:00',
    label: 'Saturday · 21:00',
    displayName: 'Clan Sanctuary',
  },
]

/* Automatic attendance reward rules from the clan reward table.
   Perfect Attendance is a separate weekly +150 bonus. */
const ATTENDANCE_REWARDS = {
  'Inter-Server Battle': { base: 100, bonuses: [5, 10, 15, 20] },
  'World Boss': { base: 50, bonuses: [3, 5, 10, 15] },
  'Clan Annihilation': { base: 75, bonuses: [5, 10, 15, 20] },
