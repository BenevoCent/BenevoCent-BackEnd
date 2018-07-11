app.post('/newPurchase', function(request, response, next) {

    let trans = addSingleTransaction(request.body)

    stripe.invoiceItems.create({
        amount: +(request.body.amount),
        currency: 'usd',
        customer: request.body.uid,
        description: 'donation',
    })
    response.json(trans)

})

app.post('/stripeTransaction', (request, response) => {

    const token = request.body.token
    const charityId = request.body.charityId

    stripe.charges.create({
        amount: request.body.amount,
        currency: 'usd',
        description: `Benevocent donation to ${request.body.charityName}`,
        source: request.body.token.id,
    }, function(err, charge) {
        console.log('charge', charge)
        console.log('err', err)

        addDirectDonation(charityId, request.body.userId, request.body.amount)

    })

})

// app.post('/subscribeCustomer', (request, response) => {
//     stripe.subscriptions.create({
//         customer: request.uid,
//         items: [
//         {
//             plan: 'prod_CZgErZZBE64HLo',
//         },
//         ]
//     }, function(err, subscription) {
//         // asynchronously called
//     })
// })
  
  // app.post('/stripeUpdatePlan', (request, response) => {
  //   stripe.plans.create({
  //     amount: 5000,
  //     interval: "month",
  //     product: {
  //       name: "Benevocent Donations"
  //     },
  //     currency: "usd",
  //   }, function(err, plan) {
  //     // asynchronously called
  //   });
  // })