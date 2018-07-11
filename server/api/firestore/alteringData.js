app.post('/newGarden', (request, response) => {

    generateEmptyGarden(request.body.month, request.body.uid)
    response.sendStatus(200)
  })