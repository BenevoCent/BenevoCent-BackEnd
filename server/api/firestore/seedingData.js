app.get('/charities', function (request, response, next) {
    const charityApiEndpoint = 'https://api.data.charitynavigator.org/v2'
    const searchType = '/Organizations'
    const appId = '?app_id=INSERT_APP_ID'
    const appKey = '&app_key=INSERT_APP_KEY'
    const extraParameters = '&pageSize=30&rated=true&fundraisingOrgs=true&state=NY&minRating=4&maxRating=4&scopeOfWork=REGIONAL&sort=NAME%3AASC'
    const url = `${charityApiEndpoint}${searchType}${appId}${appKey}${extraParameters}`
  
    axios
      .get(url)
      .then(charities => {
        let uidArr = charities.data.map(() => uuidv4())
        let charityNames = charities.data.map(charity => charity.charityName)
        charities.data.forEach((charity, idx) => {
          db
            .collection('charities')
            .doc(uidArr[idx])
            .set({
              name: charity.charityName,
              mission: charity.mission,
              tag: charity.tagLine,
              url: charity.websiteURL,
              category: charity.category.categoryName,
              img: charity.category.image,
              uid: uidArr[idx]
            })
        })
        response.status(200).send({ charityNames, uidArr })
      })
      .catch(err => console.error(err))
  })
  
  
  app.get('/plants', function(request, response, next) {
    let plantCol = db.collection('plants')
  
    plantCol.doc('carrot').set({name: 'carrot', unlockValue: null})
    plantCol.doc('aubergine').set({name: 'aubergine', unlockValue: 1})
    plantCol.doc('radish').set({name: 'radish', unlockValue: 2})
    plantCol.doc('broccoli').set({name: 'broccoli', unlockValue: 3})
    plantCol.doc('grapes').set({name: 'grapes', unlockValue: 4})
    plantCol.doc('onion').set({name: 'onion', unlockValue: 5})
    plantCol.doc('peas').set({name: 'peas', unlockValue: 6})
    plantCol.doc('pumpkin').set({name: 'pumpkin', unlockValue: 7})
    plantCol.doc('strawberry').set({name: 'strawberry', unlockValue: 8})
  
    response.sendStatus(200)
  
  })