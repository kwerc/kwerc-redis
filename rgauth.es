allowed_user_chars = '[a-zA-Z0-9_]'

fn login_user username password {
    if {logged_in} { return 0 }

    if {~ $req_path /login} {
        username = $p_username
        password = $p_password
    }

    if {! isempty $username && ! isempty $password} {
        # Initial login from /login form

        # Normalize case-insensitive username/email -> case-sensitive username
        username = `{echo $username | tr 'A-Z' 'a-z' | escape_redis}
        (username rpassword) = `` \n {redis graph read 'MATCH (u:user)
                                                   WHERE toLower(u.username) = '''$username''' OR
                                                         toLower(u.email) = '''$username'''
                                                   RETURN u.username, u.password'}

        # GTFO
        if {isempty $username ||
            ! kryptgo checkhash -b $rpassword -p $password} {
            dprint Failed login to $username from $HTTP_USER_AGENT on $REMOTE_ADDR
            throw error 'Wrong username/email or password'
        }

        # Generate new session ID
        sessionid = `{kryptgo genid}
        if {~ $sessionid -1} {
            dprint Session generation failed.
            throw error 'Something went wrong. Please try again later'
        }

        # We are logged in!
        logged_user = $username

        # Create session with inactive expiry in 30 mins and absolute expiry in 24 hours
        expiry = `{+ $dateun 1800}
        expiryabs = `{+ $dateun 86400}
        onboarding = `{redis graph write 'MATCH (u:user {username: '''$username'''})
                                          CREATE (u)-[:SESSION]->(s:session {id: '''$sessionid''', expiry: '$expiry', expiryabs: '$expiryabs'})
                                          RETURN u.onboarding'} # While we're in redis, get $onboarding so we know where to redirect

        dprint $logged_user logged in from $HTTP_USER_AGENT on $REMOTE_ADDR
    } {! isempty `{get_cookie id}} {
        # Existing login from session cookie

        sessionid = `{get_cookie id}

        # Check if ID is valid, session exists and is not expired
        if {! echo $sessionid | grep -s '^[a-zA-Z0-9_\-]+$' ||
            ~ `{redis graph read 'MATCH (s:session {id: '''$sessionid'''})
                                  RETURN exists(s) AND
                                         s.expiry >= '$dateun' AND
                                         s.expiryabs >= '$dateun} false} {
            set_cookie id logout 'Thu, 01 Jan 1970 00:00:00 GMT'
            throw error 'Session expired. Please log in again'
        }

        # We are logged in! Update inactive expiry and get info we'll need later
        expiry = `{+ $dateun 1800}
        (logged_user expiryabs onboarding) = `` \n {redis graph write 'MATCH (u:user)-[:SESSION]->(s:session {id: '''$sessionid'''})
                                                                  SET s.expiry = '$expiry'
                                                                  RETURN u.username, s.expiryabs, u.onboarding'}
    } {
        # The user has not requested to log in
        return 0
    }

    # Set session cookie with expiration as min($expiry, $expiryabs)
    if {lt $expiry $expiryabs} {
        set_cookie id $sessionid `{date -u $expiry | sed 's/(...) (...) (..) (........) (...) (....)/\1, \3 \2 \6 \4 \5/; s/  / 0/'}
    } {
        set_cookie id $sessionid `{date -u $expiryabs | sed 's/(...) (...) (..) (........) (...) (....)/\1, \3 \2 \6 \4 \5/; s/  / 0/'}
    }

    # If the user hasn't finished setting up their profile, send them back to onboarding
    if {~ $req_path / && ! isempty $onboarding} {
        post_redirect $base_url/onboarding/$onboarding
    }

    # If this was an initial login from /login form, redirect...
    if {! isempty $username && ! isempty $password} {
        if {echo $q_redirect | grep -s '^'$allowed_user_chars'/+$'} {
            # ...to the provided ?redirect=/path, if it's safe
            post_redirect $base_url$q_redirect
        } {
            # ...to the homepage
            post_redirect $base_url
        }
    }
}

fn logout_user {
    # Delete session, expire cookie, and redirect to /login
    redis graph write 'MATCH (s:session {id: '''`^{get_cookie id | sed 's/[^a-zA-Z0-9_\-]//g'}^'''}) DELETE s'
    set_cookie id logout 'Thu, 01 Jan 1970 00:00:00 GMT'
    post_redirect $base_url/login
}

fn logged_in { ! isempty $logged_user }
