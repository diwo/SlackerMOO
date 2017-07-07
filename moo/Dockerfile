FROM toddsundsted/stunt:latest

ADD resources/cores/LambdaCore-17May04.db.gz /usr/local/lib/moo/cores/LambdaCore.db.gz
ADD resources/cores/JHCore-DEV-2.db.gz /usr/local/lib/moo/cores/JHCore.db.gz

ADD resources/scripts/ /usr/local/lib/moo/scripts/

ADD resources/entrypoint.sh /usr/local/bin/
ADD resources/run-script.sh /usr/local/bin/

ENTRYPOINT ["entrypoint.sh"]
CMD ["DefaultMOO", "7777"]
