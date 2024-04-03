[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-24ddc0f5d75046c5622901739e7c5dd533143b0c8e959d652212380cedb1ea36.svg)](https://classroom.github.com/a/OiggXh1o)
# CSE330
Grace Huang - 508576 - gracehjy

John Paul Pineda - 508919 - johnpp4

## Link
http://ec2-100-27-27-36.compute-1.amazonaws.com:3456/client.html 

## Required Functionality
- Users can create chat rooms with an arbitrary room name
- Users can join an arbitrary chat room
- The chat room displays all users currently in the room
- A private room can be created that is password protected
- Creators of chat rooms can temporarily kick others out of the room 
- Creators of chat rooms can permanently ban users from joining that particular room 
- A user's message shows their username and is sent to everyone in the room
- Users can send private messages to another user in the same room

## Creative Portion
- added a chatbot that notifys users of room events
- added timestamps to every message
- added options for users to select from a list of emojis to include in their messages
- all users have unique usernames (have to refresh after the error alert tho in order to re-enter a username)
- users are alerted when errors occur (e.g. username already taken, incorrect room password, room already created, etc.)
