FROM toddsundsted/stunt:latest

ADD resources/LambdaCore-17May04.db.gz /usr/local/lib/LambdaCore.db.gz
ADD resources/JHCore-DEV-2.db.gz /usr/local/lib/JHCore.db.gz
ADD resources/entrypoint.sh /usr/local/bin/

ENTRYPOINT ["entrypoint.sh"]
CMD ["DefaultMOO", "7777"]
