const sendHello = async(req, res) => {
    return res.json({
        message: "hello World"
    })
}

module.exports = {
    sendHello
}