const add = require("./add")
const NATS = require("nats");
const nats = NATS.connect();

const subscribeEvent = process.env.getMessageEvent || "foo";
const publishEvent = process.env.sendMessageEvent || "bar";
const constantMessage = process.env.message || "et dah";

console.log(`Listen to ${subscribeEvent} event`);
nats.subscribe(subscribeEvent, (receivedMessage) => {
    console.log(`Received a message: ${receivedMessage}`);
    const calculatorResult = add(1, 1);
    const publishedMessage = `${constantMessage} ${receivedMessage}, 1 + 1 = ${calculatorResult}`;
    console.log(`Publish to ${publishEvent} event: ${publishedMessage}`);
    nats.publish(publishEvent, publishedMessage);
});