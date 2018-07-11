function generateEmptyGarden(specifiedMonth, uid){


    let date = new Date()
    let month = !specifiedMonth ? `${date.getFullYear()}-0${date.getMonth() + 1}` : specifiedMonth
  
    db.collection('gardens')
      .doc(uid)
      .collection('user_gardens')
      .doc(month)
      .set({
        0: null,
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null
    })
  
}