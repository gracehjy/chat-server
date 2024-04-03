const http = require("http");
const fs = require("fs");
const socketio = require("socket.io");

const port = 3456;
const file = "client2.html";
const server = http.createServer(function (req, res) {
    fs.readFile(file, function (err, data) {
        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);

const io = socketio(server);
const users = {};
const rooms = { 'lobby': { isPrivate: false, members: [], password: '' } }; // initialize lobby as a default room
const bannedUsers = {}; // um wip lol
const roomOwner = {}; // also wip lol
const kickedUsers = {};

// ON CONNECTIONNNN do this pls
io.on("connection", function (socket) {

     // make sure users can already see existing rooms
     const roomList = getRoomList()
     socket.emit('update_room_list', { rooms: roomList });

    socket.on('join_lobby', ({username}) => {
        // check if the username is already taken
        if (Object.values(users).some(user => user.username === username)) {
            socket.emit('error', { message: 'Username is already taken, please choose another one.' });
            return;
        }

        // log user into the lobby
        users[socket.id] = { username: username, room: 'lobby' };
        socket.join('lobby');
        updateusers('lobby');
        socket.emit('room_joined', { room: 'lobby', isOwner: false});

        console.log(`${username} has joined the lobby.`);
        io.to('lobby').emit('message_to_client', {
            username: 'ChatBot',
            message: `: ${username} has joined the room.`
        });
    });

    // let users pm each other
    socket.on('private_message', function({ toUsername, message, fromUsername }) {
        const recipientSocketId = Object.keys(users).find(key => users[key].username === toUsername);
        const senderSocketId = Object.keys(users).find(key => users[key].username === fromUsername);
        // if the user receiving exists, emit the message to their chat log
        if (recipientSocketId) {
            const timestamp = new Date().toLocaleTimeString();
            const newMessage = ` [${timestamp}]: ${message}`;
            io.to(recipientSocketId).emit('private_message_received', {
                fromUsername: fromUsername, 
                message: newMessage,
            });
            io.to(senderSocketId).emit('private_message_to', {
                message: newMessage,
                toUsername: toUsername
            });
        } else {
            socket.emit('error', { message: `User ${toUsername} not found.` });
        }
    });

    // event that a user joins a room
    socket.on('join_room', ({ roomName, password }) => {
        const user = users[socket.id];
        const oldRoom = user.room;
        let isOwner = determineIfOwner(socket.id, roomName); 

        // if kicked, give alert
        const now = new Date();
        if (kickedUsers[roomName] && kickedUsers[roomName][username] && now < kickedUsers[roomName][username]) {
            const kickedDurationLeft = (kickedUsers[roomName][username] - now) / 120; 
            socket.emit('error', { message: `You are temporarily kicked from ${roomName}. Please wait ${kickedDurationLeft.toFixed(1)} more minutes.` });
            return;
        }

        // if banned, emit an error
        if (bannedUsers[roomName] && bannedUsers[roomName].includes(username)) {
            socket.emit('error', { message: 'You are banned from this room.'});
            return;
        }

        // join/leave room logistics
        if (rooms[roomName] && (!rooms[roomName].isPrivate || rooms[roomName].password === password)) {
            socket.leave(oldRoom);
            socket.join(roomName);
            user.room = roomName;
            updateusers(oldRoom);
            updateusers(roomName);

            console.log(`${user.username} has left ${oldRoom}.`)
            console.log(`${user.username} has joined ${roomName}.`)
        
            const userSocketId = Object.keys(users).find(key => users[key].username === user.username);

            io.to(socket.id).emit('room_joined', { room: roomName, isOwner: roomOwner[roomName] === userSocketId});

            // notify both rooms about the user
            io.to(roomName).emit('message_to_client', {
                username: 'ChatBot',
                message: `: ${user.username} has joined the room.`
            });
            io.to(oldRoom).emit('message_to_client', {
                username: 'ChatBot',
                message: `: ${user.username} has left the room.`
            });
        } else {
            socket.emit('error', { message: 'Invalid room name or password.'});
        }
    });
    
    // event that a user creates a new room
    socket.on('create_room', ({ roomName, isPrivate, password }) => {
        // if room exists give an error
        if (rooms[roomName]) {
            socket.emit('error', { message: 'Room already exists'});
        } else {
            // create the room
            rooms[roomName] = { isPrivate, password, members: [socket.id] };

            // update the user's room
            const user = users[socket.id];
            const oldRoom = user.room;
            user.room = roomName;
            
            // set roomOwner to the user's socket.id
            roomOwner[roomName] = socket.id;
 
            socket.leave(oldRoom);
            socket.join(roomName);
            const userSocketId = Object.keys(users).find(key => users[key].username === user.username);

            io.to(socket.id).emit('room_joined', { room: roomName, isOwner: roomOwner[roomName] === userSocketId});

            // notify the old room that the user has left
            if (oldRoom) {
                io.to(oldRoom).emit('message_to_client', {
                    username: 'ChatBot',
                    message: `: ${user.username} has left the room.`
                });
                updateusers(oldRoom);
            }
            updateRoomList();
            // notify the new room that the user has joined
            io.to(roomName).emit('message_to_client', {
                username: 'ChatBot',
                message: `: ${user.username} has joined the room.`
            });
            updateusers(roomName);

            // server side console logs
            console.log(`${user.username} has left ${oldRoom}.`)
            console.log(`${user.username} has joined ${roomName}.`)
        }
    });

    // event to kick a user
    socket.on('kick_user', ({ usernameToKick, roomName }) => {
        console.log("entered kick_user");
        if (rooms[roomName] && roomOwner[roomName] === socket.id) {
            const socketIdToKick = Object.keys(users).find(key => users[key].username === usernameToKick);
            if (socketIdToKick) {
                const kickedSocket = io.sockets.sockets.get(socketIdToKick);
                if (kickedSocket) {
                    kickedSocket.leave(roomName);
    
                    // users kicked are kicked for 60 seconds
                    const duration = 60 * 1000;
                    const kickDuration = new Date(new Date().getTime() + duration);
    
                    // record the kicked user
                    if (!kickedUsers[roomName]) kickedUsers[roomName] = {};
                    kickedUsers[roomName][usernameToKick] = kickDuration;
    
                    // notify the room that the user has been kicked
                    io.to(roomName).emit('message_to_client', {
                        username: 'ChatBot',
                        message: `: ${usernameToKick} has been kicked from the room for 60 seconds.`,
                    });
                } else {
                    console.log(`Error: Socket not found for user ${usernameToKick}`);
                }
            } else {
                console.log(`Error: User ${usernameToKick} not found.`);
            }
        }
    });
    

    // event to ban a user
    socket.on('ban_user', ({ usernameToBan, roomName }) => {
        console.log("entered ban_user");
        if (rooms[roomName] && roomOwner[roomName] === socket.id) {
            console.log("entered ban_user if 1");
            if (!bannedUsers[roomName]) {
                bannedUsers[roomName] = [];
            }
            const socketIdToBan = Object.keys(users).find(key => users[key].username === usernameToBan);
            if (socketIdToBan) {
                const banSocket = io.sockets.sockets.get(socketIdToBan);
                if (banSocket) {
                    banSocket.leave(roomName);
                    // add the username to the list of banned users
                    bannedUsers[roomName].push(usernameToBan);
                    // notify the room that the user has been banned
                    io.to(roomName).emit('message_to_client', {
                        username: 'ChatBot',
                        message: `: ${usernameToBan} has been banned from the room.`,
                    });
                } else {
                    console.log(`Error: Socket not found for user ${usernameToBan}`);
                }
            } else {
                console.log(`Error: User ${usernameToBan} not found.`);
            }
        }
    });


    // broadcast the message to users (in room vs lobby)
    socket.on('message_to_server', function ({ message, roomName }) {
        console.log("message: " + message);

        // omg we added a timestamp!!!!
        const timestamp = new Date().toLocaleTimeString();
        const newMessage = ` [${timestamp}]: ${message}`;
        io.to(roomName).emit("message_to_client", { username: users[socket.id].username, message: newMessage });
    });

    // when a user disconnects from the page, remove the user from the user list
    socket.on('disconnect', function () {
        const user = users[socket.id];
        if (user) { 
            const roomName = user.room;
            if (rooms[roomName]) {
                rooms[roomName].members = rooms[roomName].members.filter(memberId => memberId !== socket.id);
                // notify the room that a user has left
                io.to(roomName).emit('message_to_client', {
                    username: 'ChatBot',
                    message: `: ${user.username} has left the room.`
                });
                updateusers(roomName);
            }
            delete users[socket.id]; 
        }
    });

    function determineIfOwner(socketId, roomName) {
        return roomOwner[roomName] === socketId;
    }

    // update the list of users in the lobby
    function updateusers(room) {
        const roomUsers = Object.values(users)
            .filter(user => user.room === room)
            .map(user => user.username);
        io.to(room).emit('lobby_user_list', { users: roomUsers });
    }

    // update the list of rooms existings
    function updateRoomList() {
        const roomList = Object.keys(rooms).map(roomName => ({
            name: roomName,
            isPrivate: rooms[roomName].isPrivate
        }));
        io.emit('update_room_list', { rooms: roomList });
    }

    // get the roomlist
    function getRoomList() {
        return Object.keys(rooms).map(roomName => {
            return {
                name: roomName,
                isPrivate: rooms[roomName].isPrivate
            };
        });
    }
});