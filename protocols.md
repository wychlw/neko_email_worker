# Sender (SMTP(local) -> HTTP(RESTful) -> worker -> SMTP(worker))

# user api

## find user

- methods: GET
- url: /v1/users/$USERNAME

### found


```json
{
    "stat": 200,
    "token": "",
    "data": ""
}
```

### not found


```json
{
    "stat": 404,
    "token": "",
    "data": ""
}
```

## auth user

- methods: GET
- url: /v1/users/$USERNAME/password
- header: "Password: $PASSWORD"

### auth success


```json
{
    "stat": 200,
    "token": "$USER_TOKEN",
    "data": ""
}
```

### auth failed


```json
{
    "stat": 404,
    "token": "",
    "data": ""
}
```

## insert user

- methods: POST
- url: /v1/users/$USERNAME/password
- header: "Password: $PASSWORD"
- header: "Token: $ADMIN_TOKEN"
- header: "Admin: 0 | 1"

### insert success


```json
{
    "stat": 200,
    "token": "",
    "data": ""
}
```

### admin not authorized


```json
{
    "stat": 401,
    "token": "",
    "data": ""
}
```

### user already exists


```json
{
    "stat": 409,
    "token": "",
    "data": ""
}
```

## update user

- methods: PUT
- url: /v1/users/$USERNAME/password
- header: "Oldpass: $OLDPASSWORD" // can't change is_admin unless itself is an admin, not require if admin token is given
- header: "Newpass: $NEWPASSWORD" // optional if want to change ppassword
- header: "Token: $ADMIN_TOKEN" // can change anything if use this
- header: "Admin: 0 | 1" // if want to change is_admin, must be a admin(token) to change this field

### update success


```json
{
    "stat": 200,
    "token": "",
    "data": ""
}
```

### admin not authorized


```json
{
    "stat": 401,
    "token": "",
    "data": ""
}
```

### auth failed


```json
{
    "stat": 403,
    "token": "",
    "data": ""
}
```

## delete user

- methods: DELETE
- url: /v1/users/$USERNAME/password
- header: "Password: $PASSWORD" // if provided, must be true password; if not provided, token must be an admin
- header: "Token: $ADMIN_TOKEN" // if provided, must be an admin
- 
### update success


```json
{
    "stat": 200,
    "token": "",
    "data": ""
}
```

### auth failed


```json
{
    "stat": 403,
    "token": "",
    "data": ""
}
```

# mail api

## mail meta info

- methods: GET
- url: /v1/mail/
- header: "Token: $USERTOKEN"

### success

```json
{
    "stat": 200,
    "token": "",
    "data": {
        "num": $mail_num,
        "size": $mail_size,
        "mails": [
            {
                "id": $mail_id,
                "size": $mail_size
            }
        ]
    }
}
```

### unauthorized

```json
{
    "stat": 401,
    "token": "",
    "data": ""
}
```

### not found

```json
{
    "stat": 404,
    "token": "",
    "data": ""
}
```

## get mail content

- methods: GET
- url: /v1/mail/$MAILID
- header: "Token: $USERTOKEN"

### success

```json
{
    "stat": 200,
    "token": "",
    "data": {
        "id": $mail_id,
        "size": $mail_size,
        "content": $BASE64_CODED_MAIL_CONTENT
    }
}
```

### unauthorized

```json
{
    "stat": 401,
    "token": "",
    "data": ""
}
```

### not found

```json
{
    "stat": 404,
    "token": "",
    "data": ""
}
```

## delete mail

- methods: DELETE
- url: /v1/mail/$MAILID
- header: "Token: $USERTOKEN"

### unauthorized

```json
{
    "stat": 401,
    "token": "",
    "data": ""
}
```

### not found

```json
{
    "stat": 404,
    "token": "",
    "data": ""
}
```

## send mail

- methods: POST
- url: /v1/mail/
- header: "Token: $USERTOKEN"
- body:
```json
{
    "from": $FROM_USER_EMAIL,
    "to": $TO_USER_EMAILS[],
    "content": $BASE64_ENCODED_CONTENT
}
```

### unauthorized

```json
{
    "stat": 401,
    "token": "",
    "data": ""
}
```

### not found

```json
{
    "stat": 404,
    "token": "",
    "data": ""
}
```

### no content

```json
{
    "stat": 500,
    "token": "",
    "data": ""
}