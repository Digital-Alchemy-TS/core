### Future Enhancements

#### Scene Handoffs

Better support for automatically moving between scenes based on different circumstances needs to be implemented. This is currently a very manual process that needs to be implemented in the logic for each room. 

This would be better off built into the scene definitions. There can be a callback that is a "redirect on set" type of situation. If you try to set `high`, this function can say "I see you're TRYING to do `high`, but it's after sunset, so gonna ignore what you said and do `evening_high` instead"

> [!note] :brain: Mental note

This can ALSO be implemented as a "dynamic scene" type of situation. Where the actual definition of `high` changes based off certain events. One of the two basic strategies should be chosen between, but there isn't a distinct advantage to either right now.

